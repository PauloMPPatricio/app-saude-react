import React, { useState, useEffect, useRef } from 'react';
import { Bell, Plus, Trash2, Check, Clock, Pill, ChevronLeft, Upload, Pencil, Calendar, AlertCircle, Infinity, X } from 'lucide-react';

// ============================================================================
//  ÁREA RESERVADA PARA A LOGO
// ============================================================================
const LOGO_DO_APP = "/logo_sm-v1.0.png"; 
// ============================================================================

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [meds, setMeds] = useState([]);
  const [permission, setPermission] = useState('default');
  const [editingMed, setEditingMed] = useState(null);
  
  // Estado para o ALARME VISUAL (Tela cheia)
  const [activeAlarmMed, setActiveAlarmMed] = useState(null);
  
  const audioRef = useRef(null);

  useEffect(() => {
    const savedMeds = localStorage.getItem('saudeNaMaoMeds');
    if (savedMeds) {
      setMeds(JSON.parse(savedMeds));
    }
    // Tenta pedir permissão sem quebrar se não suportado
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('saudeNaMaoMeds', JSON.stringify(meds));
  }, [meds]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      setMeds(prevMeds => prevMeds.map(med => {
        if (med.totalDoses && med.takenCount >= med.totalDoses) return med;
        
        // Se já passou da hora e ainda não foi notificado
        if (!med.notified && med.nextDose <= now) {
          triggerAlarm(med); // Dispara som e tela visual
          return { ...med, notified: true, isLate: true };
        }
        return med;
      }));
    }, 5000); // Verifica a cada 5s
    return () => clearInterval(interval);
  }, []);

  const triggerAlarm = (med) => {
    // 1. Tocar som (Protegido contra erros)
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log("Som requer interação prévia"));
    }

    // 2. Mostrar Alerta Visual no App (Garantido)
    setActiveAlarmMed(med);

    // 3. Tentar Notificação Nativa (Protegido contra o erro do Android)
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        // Em mobile, isso pode falhar, então usamos o try/catch
        navigator.serviceWorker.ready.then(registration => {
           registration.showNotification(`Hora do Remédio: ${med.name}`, {
              body: `Hora de tomar ${med.amount || med.dosage}`,
              icon: LOGO_DO_APP
           });
        }).catch(() => {
           // Fallback para notificação simples se SW falhar
           new Notification(`Hora do Remédio: ${med.name}`, {
             body: `Está na hora de tomar ${med.amount || med.dosage}.`,
             icon: LOGO_DO_APP
           });
        });
      }
    } catch (e) {
      console.log("Notificação nativa não suportada neste navegador móvel, usando alerta visual.");
    }
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
      } catch (e) {
        console.log("Erro ao pedir permissão");
      }
    }
  };

  // --- Lógica de agendamento ---
  const findNextScheduledDose = (timesArray) => {
    if (!timesArray || timesArray.length === 0) return new Date().getTime();

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeVal = currentHour * 60 + currentMinute;

    const timesInMinutes = timesArray.map(t => {
      const [h, m] = t.split(':').map(Number);
      return { timeStr: t, val: h * 60 + m };
    }).sort((a, b) => a.val - b.val);

    const nextToday = timesInMinutes.find(t => t.val > currentTimeVal);

    if (nextToday) {
      const nextDate = new Date();
      const [h, m] = nextToday.timeStr.split(':').map(Number);
      nextDate.setHours(h, m, 0, 0);
      return nextDate.getTime();
    } else {
      const firstTomorrow = timesInMinutes[0];
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 1);
      const [h, m] = firstTomorrow.timeStr.split(':').map(Number);
      nextDate.setHours(h, m, 0, 0);
      return nextDate.getTime();
    }
  };

  // --- Ações CRUD ---

  const handleSaveMed = (medData) => {
    let total = null;
    if (medData.duration && medData.frequency) {
      const dosesPerDay = 24 / medData.frequency;
      total = Math.ceil(dosesPerDay * medData.duration);
    }

    const firstNextDose = findNextScheduledDose(medData.scheduleTimes);
    const takenCount = editingMed ? (editingMed.takenCount || 0) : 0;

    const finalData = { 
      ...medData, 
      nextDose: firstNextDose, 
      notified: false, 
      isLate: false,
      totalDoses: total,
      takenCount: takenCount
    };

    if (editingMed) {
      setMeds(meds.map(m => m.id === medData.id ? finalData : m));
      setEditingMed(null);
    } else {
      setMeds([...meds, finalData]);
    }
    setCurrentScreen('home');
  };

  const handleEditMed = (med) => {
    setEditingMed(med);
    setCurrentScreen('add');
  };

  const handleDelete = (id) => {
    if (window.confirm("Deseja remover este medicamento da lista?")) {
      setMeds(meds.filter(m => m.id !== id));
    }
  };

  const handleTake = (id) => {
    // Se foi chamado pelo alarme visual, fecha ele
    if (activeAlarmMed && activeAlarmMed.id === id) {
      setActiveAlarmMed(null);
      if(audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
      }
    }

    setMeds(prevMeds => prevMeds.map(med => {
      if (med.id === id) {
        const nextTime = findNextScheduledDose(med.scheduleTimes);
        const newTakenCount = (med.takenCount || 0) + 1;
        const isFinished = med.totalDoses && newTakenCount >= med.totalDoses;

        return {
          ...med,
          lastTaken: new Date().getTime(),
          nextDose: nextTime,
          notified: false,
          isLate: false,
          takenCount: newTakenCount,
          isFinished: isFinished
        };
      }
      return med;
    }));
  };

  const handleDismissAlarm = () => {
      setActiveAlarmMed(null);
      if(audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
      }
  };

  const handleCancelForm = () => {
    setEditingMed(null);
    setCurrentScreen('home');
  };

  const handleOpenAdd = () => {
    setEditingMed(null);
    setCurrentScreen('add');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start pt-0 sm:pt-10 font-sans">
      <div className="w-full max-w-md bg-white sm:rounded-3xl shadow-2xl overflow-hidden min-h-screen sm:min-h-[800px] relative flex flex-col">
        
        <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" loop />

        {/* TELA DE ALARME (OVERLAY) */}
        {activeAlarmMed && (
            <div className="absolute inset-0 z-50 bg-teal-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-300">
                <div className="animate-bounce mb-6">
                    <Bell size={64} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2 text-center">Hora do Remédio!</h2>
                <p className="text-teal-100 text-lg mb-8 text-center">Está na hora de tomar sua dose.</p>
                
                <div className="bg-white text-slate-800 p-6 rounded-3xl w-full shadow-2xl mb-8 text-center">
                    <h3 className="text-2xl font-bold text-teal-700 mb-2">{activeAlarmMed.name}</h3>
                    <p className="text-lg font-medium text-slate-600">{activeAlarmMed.amount || activeAlarmMed.dosage}</p>
                </div>

                <div className="flex flex-col gap-4 w-full">
                    <button 
                        onClick={() => handleTake(activeAlarmMed.id)}
                        className="bg-white text-teal-700 font-bold py-4 rounded-2xl text-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        <Check size={24} /> JÁ TOMEI
                    </button>
                    <button 
                        onClick={handleDismissAlarm}
                        className="text-white/80 font-medium py-3 hover:text-white transition-colors"
                    >
                        Lembrar depois (Fechar)
                    </button>
                </div>
            </div>
        )}

        {/* Header */}
        <header className="bg-teal-600 text-white p-6 pb-12 rounded-b-[2.5rem] shadow-md relative z-10">
          <div className="flex justify-between items-center mb-4">
            {currentScreen === 'add' ? (
              <button onClick={handleCancelForm} className="p-2 hover:bg-teal-700 rounded-full transition-colors">
                <ChevronLeft size={24} />
              </button>
            ) : (
              <div className="w-8"></div>
            )}
            
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-2 rounded-xl shadow-sm">
                <img src={LOGO_DO_APP} alt="Logo" className="w-12 h-12 object-contain" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Saúde na Mão</h1>
            </div>
            
            <div className="w-8"></div>
          </div>
          
          {currentScreen === 'home' && (
             <div className="text-center">
               <p className="text-teal-100 text-sm">Gerencie sua saúde com precisão.</p>
               {permission !== 'granted' && 'Notification' in window && (
                 <button onClick={requestPermission} className="mt-3 text-xs bg-teal-800/50 hover:bg-teal-800 py-1.5 px-3 rounded-full flex items-center gap-2 mx-auto transition-all">
                   <Bell size={12} /> Ativar Notificações
                 </button>
               )}
             </div>
          )}
        </header>

        {/* Conteúdo */}
        <main className="flex-1 p-4 -mt-6 z-20 overflow-y-auto pb-24">
          {currentScreen === 'home' ? (
            <HomeScreen 
              meds={meds} 
              onDelete={handleDelete} 
              onEdit={handleEditMed}
              onTake={handleTake} 
            />
          ) : (
            <AddMedScreen 
              onSave={handleSaveMed} 
              onCancel={handleCancelForm}
              initialData={editingMed}
            />
          )}
        </main>

        {/* Botão Flutuante (FAB) */}
        {currentScreen === 'home' && (
          <div className="absolute bottom-6 right-6 z-30">
            <button 
              onClick={handleOpenAdd}
              className="bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-2xl shadow-lg shadow-teal-600/40 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
            >
              <Plus size={28} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// --- Tela: Lista de Medicamentos ---

function HomeScreen({ meds, onDelete, onEdit, onTake }) {
  if (meds.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100 mt-4 flex flex-col items-center">
        <div className="bg-teal-50 p-4 rounded-full mb-4">
          <Pill size={40} className="text-teal-300" />
        </div>
        <h3 className="text-slate-600 font-bold text-lg">Nenhum medicamento</h3>
        <p className="text-slate-400 text-sm mt-2">Toque no botão + para adicionar.</p>
      </div>
    );
  }

  const sortedMeds = [...meds].sort((a, b) => {
    if (a.isFinished && !b.isFinished) return 1;
    if (!a.isFinished && b.isFinished) return -1;
    return a.nextDose - b.nextDose;
  });

  return (
    <div className="space-y-4">
      {sortedMeds.map(med => {
        const isLate = !med.isFinished && new Date().getTime() >= med.nextDose;
        const nextDate = new Date(med.nextDose);
        const isContinuous = !med.totalDoses;
        
        let borderClass = 'border-teal-500';
        if (med.isFinished) borderClass = 'border-slate-300 bg-slate-50 opacity-80';
        else if (isLate) borderClass = 'border-red-500 ring-1 ring-red-100';

        return (
          <div key={med.id} className={`bg-white p-4 rounded-2xl shadow-sm border-l-[6px] transition-all relative overflow-hidden group ${borderClass}`}>
            
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className={`font-bold text-lg ${med.isFinished ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{med.name}</h3>
                <div className="flex flex-wrap items-center gap-2 text-slate-500 text-xs mt-1 font-medium">
                  {med.dosage && <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{med.dosage}</span>}
                  {med.amount && <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded">{med.amount}</span>}
                  <span>• A cada {med.frequency}h</span>
                </div>
              </div>
              
              <div className="flex gap-1">
                {!med.isFinished && (
                  <button onClick={() => onEdit(med)} className="text-slate-300 hover:text-teal-600 p-2 rounded-full hover:bg-teal-50">
                    <Pencil size={18} />
                  </button>
                )}
                <button onClick={() => onDelete(med.id)} className="text-slate-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="mt-2 mb-3">
              {isContinuous ? (
                <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">
                  <Infinity size={12} /> Uso Contínuo
                </div>
              ) : med.totalDoses && (
                <>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase mb-1">
                      <span>Progresso</span>
                      <span>{med.takenCount} / {med.totalDoses} doses</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${med.isFinished ? 'bg-green-500' : 'bg-teal-500'}`} 
                        style={{ width: `${Math.min((med.takenCount / med.totalDoses) * 100, 100)}%` }}
                      ></div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-end justify-between mt-2 pt-2 border-t border-slate-50">
              <div>
                {med.isFinished ? (
                   <div className="flex items-center gap-1.5 text-green-600 font-bold">
                     <Check size={18} />
                     <span>Concluído</span>
                   </div>
                ) : (
                  <>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Próxima Dose</p>
                    <div className={`flex items-center gap-1.5 ${isLate ? 'text-red-600' : 'text-slate-700'}`}>
                      <Clock size={16} />
                      <span className="font-bold text-lg">
                        {isLate ? 'AGORA' : nextDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {!med.isFinished && (
                <button 
                  onClick={() => onTake(med.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 ${
                    isLate 
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                    : 'bg-teal-50 hover:bg-teal-100 text-teal-700'
                  }`}
                >
                  <Check size={18} />
                  TOMAR
                </button>
              )}
              
              {med.isFinished && (
                <button 
                  onClick={() => onDelete(med.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={16} /> Remover
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Tela: Formulário ---

function AddMedScreen({ onSave, onCancel, initialData }) {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('8');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [isContinuous, setIsContinuous] = useState(false);
  
  const [startTime, setStartTime] = useState('08:00'); 
  const [generatedTimes, setGeneratedTimes] = useState([]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDosage(initialData.dosage || '');
      setFrequency(initialData.frequency.toString());
      setAmount(initialData.amount || '');
      
      if (initialData.duration) {
        setDuration(initialData.duration);
        setIsContinuous(false);
      } else {
        setDuration('');
        setIsContinuous(true);
      }
      
      if (initialData.scheduleTimes && initialData.scheduleTimes.length > 0) {
        setStartTime(initialData.scheduleTimes[0]);
      }
    }
  }, [initialData]);

  useEffect(() => {
    calculateSchedule(startTime, frequency);
  }, [startTime, frequency]);

  useEffect(() => {
    if (isContinuous) setDuration('');
  }, [isContinuous]);

  const calculateSchedule = (start, freq) => {
    const freqNum = Number(freq);
    if (!freqNum || !start) return;

    const [startHour, startMinute] = start.split(':').map(Number);
    const slots = Math.floor(24 / freqNum); 
    
    const times = [];
    for (let i = 0; i < slots; i++) {
      let h = (startHour + (i * freqNum)) % 24;
      const timeString = `${h.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      times.push(timeString);
    }
    setGeneratedTimes(times);
  };

  const calculateTotalDoses = () => {
    if (isContinuous) return "Indeterminado (Uso Contínuo)";
    if (!duration || !frequency) return 0;
    const dosesPerDay = 24 / Number(frequency);
    return Math.ceil(dosesPerDay * Number(duration));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !frequency) return;

    const medData = {
      id: initialData ? initialData.id : Date.now(),
      name,
      dosage,
      amount,
      duration: isContinuous ? null : (duration ? Number(duration) : null),
      frequency: Number(frequency),
      scheduleTimes: generatedTimes,
    };

    onSave(medData);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm animate-in slide-in-from-right duration-300 pb-10">
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        {initialData ? 'Editar Planejamento' : 'Novo Medicamento'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-2">Nome do Remédio</label>
          <input 
            type="text" 
            placeholder="Ex: Amoxicilina"
            className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">Gramatura</label>
            <input 
              type="text" 
              placeholder="Ex: 500mg"
              className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">Intervalo</label>
            <div className="relative">
              <select 
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none appearance-none font-medium"
              >
                <option value="4">4 em 4 horas</option>
                <option value="6">6 em 6 horas</option>
                <option value="8">8 em 8 horas</option>
                <option value="12">12 em 12 horas</option>
                <option value="24">1 vez ao dia</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Clock size={16} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">Dosagem</label>
            <input 
              type="text" 
              placeholder="Ex: 1 comp"
              className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-slate-500">Duração (dias)</label>
                <div className="flex items-center gap-1.5">
                    <input 
                        type="checkbox" 
                        id="continuous"
                        checked={isContinuous} 
                        onChange={(e) => setIsContinuous(e.target.checked)}
                        className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                    <label htmlFor="continuous" className="text-[10px] uppercase font-bold text-teal-600 cursor-pointer">Uso contínuo</label>
                </div>
            </div>
            <input 
              type="number" 
              placeholder={isContinuous ? "Indeterminado" : "Ex: 7"}
              disabled={isContinuous}
              className={`w-full p-4 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 transition-all outline-none ${isContinuous ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:bg-white'}`}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>

        {(isContinuous || (duration && frequency)) && (
          <div className="flex items-center gap-2 text-xs text-teal-600 font-medium bg-teal-50 p-3 rounded-lg">
            <Calendar size={14} />
            {isContinuous ? (
                <span>Previsão: <b>Uso Contínuo</b> (sem data de término).</span>
            ) : (
                <span>Previsão: Serão tomadas <b>{calculateTotalDoses()} doses</b> no total.</span>
            )}
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <label className="block text-sm font-bold text-teal-700 mb-3 flex items-center gap-2">
            <Clock size={16} /> Definir Horários Diários
          </label>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 font-semibold uppercase ml-1">Horário da 1ª Dose</label>
              <input 
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1 ml-1">Os demais horários do dia são ajustados automaticamente.</p>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
               {generatedTimes.map((time, index) => (
                 <div key={index} className={`p-2 rounded-lg text-center border ${index === 0 ? 'bg-teal-100 border-teal-200 text-teal-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span className="text-[10px] block opacity-60 uppercase">{index + 1}ª vez</span>
                    <span className="font-bold">{time}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <button 
            type="button" 
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="flex-1 py-3.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/25 transition-all active:scale-95"
          >
            {initialData ? 'Salvar Alterações' : 'Iniciar Tratamento'}
          </button>
        </div>
      </form>
    </div>
  );
}