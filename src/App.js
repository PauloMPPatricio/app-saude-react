import React, { useState, useEffect, useRef } from "react";
// IMPORTANTE: Adicione "lucide-react" na aba "Dependencies" do CodeSandbox para os ícones funcionarem
import {
  Bell,
  Plus,
  Trash2,
  Check,
  Clock,
  Pill,
  ChevronLeft,
  Upload,
  Pencil,
  Calendar,
  Infinity,
  Menu,
  Settings,
  FileText,
  User,
  X,
  AlarmClock,
  AlertTriangle,
  Syringe,
  Beaker,
  Stethoscope,
  ClipboardList,
} from "lucide-react";

// ============================================================================
//  ÁREA RESERVADA PARA A LOGO
// ============================================================================
const LOGO_DO_APP = "/logo_sm-v1.0.png";
// ============================================================================

export default function App() {
  // --- INJEÇÃO AUTOMÁTICA DE ESTILO (TAILWIND) ---
  useEffect(() => {
    if (!document.getElementById("tailwind-script")) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      script.id = "tailwind-script";
      document.head.appendChild(script);
    }
  }, []);
  // ------------------------------------------------

  // Estados de Navegação
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [meds, setMeds] = useState([]);
  const [permission, setPermission] = useState("default");
  const [editingMed, setEditingMed] = useState(null);

  // Estados de Alarme
  const [activeAlarmMed, setActiveAlarmMed] = useState(null);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

  const audioRef = useRef(null);

  // Filtra medicamentos atrasados para mostrar no Dashboard
  const pendingMeds = meds.filter(
    (med) => !med.isFinished && new Date().getTime() >= med.nextDose
  );

  // Inicialização
  useEffect(() => {
    const savedMeds = localStorage.getItem("saudeNaMaoMeds");
    if (savedMeds) {
      setMeds(JSON.parse(savedMeds));
    }
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("saudeNaMaoMeds", JSON.stringify(meds));
  }, [meds]);

  // Timer de Lembretes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      setMeds((prevMeds) =>
        prevMeds.map((med) => {
          if (med.totalDoses && med.takenCount >= med.totalDoses) return med;

          if (!med.notified && med.nextDose <= now) {
            triggerAlarm(med);
            return { ...med, notified: true, isLate: true };
          }
          return med;
        })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerAlarm = (med) => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .catch((e) => console.log("Som requer interação prévia"));
    }
    setActiveAlarmMed(med);
    setShowSnoozeOptions(false);

    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`Hora do Remédio: ${med.name}`, {
          body: `Está na hora de tomar ${med.amount || med.dosage}.`,
          icon: LOGO_DO_APP,
        });
      }
    } catch (e) {
      console.log("Notificação nativa não suportada.");
    }
  };

  const requestPermission = async () => {
    if ("Notification" in window) {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
      } catch (e) {
        console.log("Erro ao pedir permissão");
      }
    }
  };

  const findNextScheduledDose = (timesArray) => {
    if (!timesArray || timesArray.length === 0) return new Date().getTime();
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeVal = currentHour * 60 + currentMinute;

    const timesInMinutes = timesArray
      .map((t) => {
        const [h, m] = t.split(":").map(Number);
        return { timeStr: t, val: h * 60 + m };
      })
      .sort((a, b) => a.val - b.val);

    const nextToday = timesInMinutes.find((t) => t.val > currentTimeVal);

    if (nextToday) {
      const nextDate = new Date();
      const [h, m] = nextToday.timeStr.split(":").map(Number);
      nextDate.setHours(h, m, 0, 0);
      return nextDate.getTime();
    } else {
      const firstTomorrow = timesInMinutes[0];
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 1);
      const [h, m] = firstTomorrow.timeStr.split(":").map(Number);
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
    const takenCount = editingMed ? editingMed.takenCount || 0 : 0;

    const finalData = {
      ...medData,
      nextDose: firstNextDose,
      notified: false,
      isLate: false,
      totalDoses: total,
      takenCount: takenCount,
    };

    if (editingMed) {
      setMeds(meds.map((m) => (m.id === medData.id ? finalData : m)));
      setEditingMed(null);
    } else {
      setMeds([...meds, finalData]);
    }
    setCurrentScreen("list");
  };

  const handleEditMed = (med) => {
    setEditingMed(med);
    setCurrentScreen("add");
  };

  const handleDelete = (id) => {
    if (window.confirm("Deseja remover este medicamento da lista?")) {
      setMeds(meds.filter((m) => m.id !== id));
    }
  };

  const handleTake = (id) => {
    if (activeAlarmMed && activeAlarmMed.id === id) {
      setActiveAlarmMed(null);
      setShowSnoozeOptions(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }

    setMeds((prevMeds) =>
      prevMeds.map((med) => {
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
            isFinished: isFinished,
          };
        }
        return med;
      })
    );
  };

  const handleSnooze = (minutes) => {
    if (!activeAlarmMed) return;
    const snoozeTime = new Date().getTime() + minutes * 60 * 1000;
    setMeds((prevMeds) =>
      prevMeds.map((med) => {
        if (med.id === activeAlarmMed.id) {
          return {
            ...med,
            nextDose: snoozeTime,
            notified: false,
            isLate: false,
          };
        }
        return med;
      })
    );
    setActiveAlarmMed(null);
    setShowSnoozeOptions(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleDismissOnly = () => {
    setActiveAlarmMed(null);
    setShowSnoozeOptions(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // --- NAVEGAÇÃO ---
  const goBack = () => {
    if (currentScreen === "add") {
      if (editingMed) setCurrentScreen("list");
      else setCurrentScreen("select_medication_type");
    } else if (currentScreen === "select_medication_type")
      setCurrentScreen("select_registration_type");
    else if (currentScreen === "select_registration_type")
      setCurrentScreen("dashboard");
    else if (currentScreen === "list") setCurrentScreen("dashboard");
  };

  const startNewRegistration = () => {
    setEditingMed(null);
    setCurrentScreen("select_registration_type");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start pt-0 sm:pt-10 font-sans">
      <div className="w-full max-w-md bg-white sm:rounded-3xl shadow-2xl overflow-hidden min-h-screen sm:min-h-[800px] relative flex flex-col">
        <audio
          ref={audioRef}
          src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
          preload="auto"
          loop
        />

        {/* --- TELA DE ALARME (OVERLAY) --- */}
        {activeAlarmMed && (
          <div className="absolute inset-0 z-50 bg-teal-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-300">
            {!showSnoozeOptions && (
              <>
                <div className="animate-bounce mb-6">
                  <Bell size={64} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2 text-center">
                  Hora do Remédio!
                </h2>
                <p className="text-teal-100 text-lg mb-8 text-center">
                  Hora de tomar sua dose.
                </p>
                <div className="bg-white text-slate-800 p-6 rounded-3xl w-full shadow-2xl mb-8 text-center">
                  <h3 className="text-2xl font-bold text-teal-700 mb-2">
                    {activeAlarmMed.name}
                  </h3>
                  <p className="text-lg font-medium text-slate-600">
                    {activeAlarmMed.amount || activeAlarmMed.dosage}
                  </p>
                </div>
                <div className="flex flex-col gap-4 w-full">
                  <button
                    onClick={() => handleTake(activeAlarmMed.id)}
                    className="bg-white text-teal-700 font-bold py-4 rounded-2xl text-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <Check size={24} /> JÁ TOMEI
                  </button>
                  <button
                    onClick={() => setShowSnoozeOptions(true)}
                    className="bg-teal-800/50 text-white font-bold py-4 rounded-2xl text-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 border border-teal-400/30"
                  >
                    <AlarmClock size={24} /> ADIAR
                  </button>
                  <button
                    onClick={handleDismissOnly}
                    className="text-white/60 font-medium py-2 hover:text-white transition-colors text-sm"
                  >
                    Apenas silenciar (Fechar)
                  </button>
                </div>
              </>
            )}
            {showSnoozeOptions && (
              <div className="w-full flex flex-col items-center animate-in slide-in-from-bottom duration-300">
                <AlarmClock size={48} className="text-white mb-4" />
                <h3 className="text-2xl font-bold mb-6">
                  Adiar por quanto tempo?
                </h3>
                <div className="grid grid-cols-2 gap-4 w-full mb-6">
                  {[5, 10, 15, 20].map((min) => (
                    <button
                      key={min}
                      onClick={() => handleSnooze(min)}
                      className="bg-white text-teal-700 font-bold py-4 rounded-2xl text-xl shadow-md active:scale-95 transition-transform hover:bg-teal-50"
                    >
                      {min} min
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowSnoozeOptions(false)}
                  className="text-white font-medium py-3 px-6 rounded-xl hover:bg-teal-700/50 transition-colors flex items-center gap-2"
                >
                  <X size={20} /> Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Header Dinâmico - Sempre Verde agora */}
        <header className="bg-teal-600 text-white pt-6 pb-5 px-6 rounded-b-3xl shadow-md relative z-10 transition-colors duration-300">
          <div className="flex justify-between items-center">
            {currentScreen !== "dashboard" ? (
              <button
                onClick={goBack}
                className="p-2 hover:bg-white/10 rounded-full transition-colors w-10 h-10 flex items-center justify-center"
              >
                <ChevronLeft size={28} />
              </button>
            ) : (
              <div className="w-10"></div>
            )}

            {currentScreen !== "dashboard" && (
              <div className="flex flex-col items-center justify-center">
                <h1 className="text-lg font-bold tracking-tight">
                  Saúde na Mão
                </h1>
              </div>
            )}

            <div className="w-10 flex justify-end">
              {currentScreen === "dashboard" &&
                permission !== "granted" &&
                "Notification" in window && (
                  <button
                    onClick={requestPermission}
                    className="p-2 bg-teal-700 text-white rounded-full animate-pulse"
                  >
                    <Bell size={20} />
                  </button>
                )}
            </div>
          </div>

          {currentScreen === "dashboard" && (
            <div className="flex flex-col items-center mt-2 mb-4 animate-in slide-in-from-top duration-500">
              <div className="bg-white p-4 rounded-3xl shadow-sm mb-4">
                <img
                  src={LOGO_DO_APP}
                  alt="Logo"
                  className="w-20 h-20 object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Saúde na Mão
              </h1>
              <p className="text-teal-100 text-sm font-medium">
                Gerencie sua saúde com precisão.
              </p>
            </div>
          )}
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto bg-slate-50 relative">
          {/* TELA INICIAL (DASHBOARD) */}
          {currentScreen === "dashboard" && (
            <div className="p-6 grid grid-cols-2 gap-4 animate-in fade-in duration-300">
              {/* CARTÃO DE PENDÊNCIAS */}
              {pendingMeds.length > 0 && (
                <div
                  onClick={() => setCurrentScreen("list")}
                  className="col-span-2 bg-red-50 border border-red-200 p-5 rounded-3xl mb-2 flex items-center gap-4 shadow-sm cursor-pointer hover:bg-red-100 transition-colors"
                >
                  <div className="bg-red-100 p-3 rounded-full text-red-600 animate-pulse">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-700 text-lg leading-tight">
                      Atenção!
                    </h3>
                    <p className="text-red-600/80 text-sm font-medium">
                      Você tem <b>{pendingMeds.length}</b>{" "}
                      {pendingMeds.length === 1
                        ? "medicamento atrasado"
                        : "medicamentos atrasados"}
                      .
                    </p>
                  </div>
                  <div className="bg-red-600 text-white p-2 rounded-full">
                    <ChevronLeft size={20} className="rotate-180" />
                  </div>
                </div>
              )}

              {/* Botões do Menu */}
              {meds.length > 0 && (
                <button
                  onClick={() => setCurrentScreen("list")}
                  className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 hover:shadow-md transition-all active:scale-95 col-span-2 sm:col-span-1"
                >
                  <div className="bg-teal-100 p-3 rounded-2xl text-teal-600">
                    <Pill size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-700">Medicamentos</h3>
                    <p className="text-xs text-slate-400">
                      {meds.length} cadastrados
                    </p>
                  </div>
                </button>
              )}

              <button
                onClick={startNewRegistration}
                className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 hover:shadow-md transition-all active:scale-95 col-span-2 sm:col-span-1"
              >
                <div className="bg-teal-100 p-3 rounded-2xl text-teal-600">
                  <Plus size={32} />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-slate-700">Novo Cadastro</h3>
                  {/* Texto removido conforme solicitado */}
                </div>
              </button>

              <div className="col-span-2 mt-4">
                <h3 className="text-sm font-bold text-slate-400 mb-3 ml-1 uppercase tracking-wider">
                  Em Breve
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <button className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center gap-2 opacity-60 cursor-not-allowed">
                    <Calendar size={20} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">
                      Histórico
                    </span>
                  </button>
                  <button className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center gap-2 opacity-60 cursor-not-allowed">
                    <FileText size={20} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">
                      Relatórios
                    </span>
                  </button>
                  <button className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center gap-2 opacity-60 cursor-not-allowed">
                    <User size={20} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">
                      Perfil
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TELA DE SELEÇÃO: TIPO DE CADASTRO */}
          {currentScreen === "select_registration_type" && (
            <div className="p-6 animate-in slide-in-from-right duration-300">
              <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
                O que deseja cadastrar?
              </h2>

              <div className="space-y-4">
                <button
                  onClick={() => setCurrentScreen("select_medication_type")}
                  className="w-full bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all active:scale-95"
                >
                  <div className="bg-teal-100 p-3 rounded-2xl text-teal-600">
                    <Pill size={28} />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-bold text-slate-700 text-lg">
                      Medicamentos
                    </h3>
                    <p className="text-xs text-slate-400">
                      Pílulas, xaropes, etc.
                    </p>
                  </div>
                  <ChevronLeft
                    size={20}
                    className="text-slate-300 rotate-180"
                  />
                </button>

                <div className="mt-8">
                  <h3 className="text-sm font-bold text-slate-400 mb-3 ml-1 uppercase tracking-wider">
                    Em Breve
                  </h3>
                  <div className="space-y-3 opacity-60">
                    <button className="w-full bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 cursor-not-allowed">
                      <div className="bg-slate-100 p-2 rounded-xl text-slate-400">
                        <Stethoscope size={24} />
                      </div>
                      <span className="font-medium text-slate-500">
                        Consultas
                      </span>
                    </button>
                    <button className="w-full bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 cursor-not-allowed">
                      <div className="bg-slate-100 p-2 rounded-xl text-slate-400">
                        <ClipboardList size={24} />
                      </div>
                      <span className="font-medium text-slate-500">Exames</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TELA DE SELEÇÃO: TIPO DE MEDICAMENTO */}
          {currentScreen === "select_medication_type" && (
            <div className="p-6 animate-in slide-in-from-right duration-300">
              <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
                Qual tipo de medicamento deseja cadastrar?
              </h2>

              <div className="space-y-4">
                <button
                  onClick={() => setCurrentScreen("add")}
                  className="w-full bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all active:scale-95"
                >
                  <div className="bg-teal-100 p-3 rounded-2xl text-teal-600">
                    <Pill size={28} />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-bold text-slate-700 text-lg">
                      Comprimido
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cápsulas ou drágeas
                    </p>
                  </div>
                  <ChevronLeft
                    size={20}
                    className="text-slate-300 rotate-180"
                  />
                </button>

                <div className="mt-8">
                  <h3 className="text-sm font-bold text-slate-400 mb-3 ml-1 uppercase tracking-wider">
                    Em Breve
                  </h3>
                  <div className="space-y-3 opacity-60">
                    <button className="w-full bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 cursor-not-allowed">
                      <div className="bg-slate-100 p-2 rounded-xl text-slate-400">
                        <Beaker size={24} />
                      </div>
                      <span className="font-medium text-slate-500">
                        Suspensão
                      </span>
                    </button>
                    <button className="w-full bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 cursor-not-allowed">
                      <div className="bg-slate-100 p-2 rounded-xl text-slate-400">
                        <Syringe size={24} />
                      </div>
                      <span className="font-medium text-slate-500">
                        Injetável
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TELA DE LISTA */}
          {currentScreen === "list" && (
            <div className="p-4 pb-24">
              <HomeScreen
                meds={meds}
                onDelete={handleDelete}
                onEdit={handleEditMed}
                onTake={handleTake}
                onAdd={startNewRegistration}
              />
            </div>
          )}

          {/* TELA DE CADASTRO (FORMULÁRIO) */}
          {currentScreen === "add" && (
            <div className="p-4 pb-24">
              <AddMedScreen
                onSave={handleSaveMed}
                onCancel={() => {
                  // Se estava editando, volta pra lista. Se era novo, volta pra seleção.
                  if (editingMed) setCurrentScreen("list");
                  else setCurrentScreen("select_medication_type");
                }}
                initialData={editingMed}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ... (HomeScreen e AddMedScreen continuam iguais aos anteriores) ...
// Para economizar espaço, vou apenas referenciar que os sub-componentes
// HomeScreen e AddMedScreen devem ser mantidos como estavam no código anterior.
// Mas para o código completo funcionar no Canvas, vou repeti-los aqui:

function HomeScreen({ meds, onDelete, onEdit, onTake, onAdd }) {
  if (meds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 opacity-60">
        <Pill size={64} className="mb-4 text-slate-300" />
        <p className="text-lg font-medium">Nenhum medicamento</p>
        <button
          onClick={onAdd}
          className="mt-4 text-teal-600 font-bold text-sm"
        >
          Cadastrar o primeiro
        </button>
      </div>
    );
  }

  const sortedMeds = [...meds].sort((a, b) => {
    if (a.isFinished && !b.isFinished) return 1;
    if (!a.isFinished && b.isFinished) return -1;
    return a.nextDose - b.nextDose;
  });

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <div className="flex justify-between items-center mb-2 px-1">
        <h2 className="font-bold text-slate-700">Seus Medicamentos</h2>
        <button
          onClick={onAdd}
          className="bg-teal-100 text-teal-700 p-2 rounded-full hover:bg-teal-200 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {sortedMeds.map((med) => {
        const isLate = !med.isFinished && new Date().getTime() >= med.nextDose;
        const nextDate = new Date(med.nextDose);
        const isContinuous = !med.totalDoses;

        let borderClass = "border-teal-500";
        if (med.isFinished)
          borderClass = "border-slate-300 bg-slate-100 opacity-80";
        else if (isLate) borderClass = "border-red-500 ring-1 ring-red-100";

        return (
          <div
            key={med.id}
            className={`bg-white p-4 rounded-2xl shadow-sm border-l-[6px] transition-all relative overflow-hidden group ${borderClass}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3
                  className={`font-bold text-lg leading-tight ${
                    med.isFinished
                      ? "text-slate-500 line-through"
                      : "text-slate-800"
                  }`}
                >
                  {med.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-slate-500 text-xs mt-1 font-medium">
                  {med.dosage && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      {med.dosage}
                    </span>
                  )}
                  {med.amount && (
                    <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded">
                      {med.amount}
                    </span>
                  )}
                  <span>• {med.frequency}h</span>
                </div>
              </div>
              <div className="flex gap-1">
                {!med.isFinished && (
                  <button
                    onClick={() => onEdit(med)}
                    className="text-slate-300 hover:text-teal-600 p-2 rounded-full hover:bg-teal-50"
                  >
                    <Pencil size={18} />
                  </button>
                )}
                <button
                  onClick={() => onDelete(med.id)}
                  className="text-slate-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="mt-2 mb-3">
              {isContinuous ? (
                <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">
                  <Infinity size={12} /> Uso Contínuo
                </div>
              ) : (
                med.totalDoses && (
                  <>
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase mb-1">
                      <span>Progresso</span>
                      <span>
                        {med.takenCount} / {med.totalDoses} doses
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          med.isFinished ? "bg-green-500" : "bg-teal-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            (med.takenCount / med.totalDoses) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </>
                )
              )}
            </div>

            <div className="flex items-end justify-between mt-2 pt-3 border-t border-slate-50">
              <div>
                {med.isFinished ? (
                  <div className="flex items-center gap-1.5 text-green-600 font-bold text-sm">
                    <Check size={18} />
                    <span>Concluído</span>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">
                      Próxima Dose
                    </p>
                    <div
                      className={`flex items-center gap-1.5 ${
                        isLate ? "text-red-600" : "text-slate-700"
                      }`}
                    >
                      <Clock size={16} />
                      <span className="font-bold text-lg">
                        {isLate
                          ? "AGORA"
                          : nextDate.toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
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
                      ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                      : "bg-teal-50 hover:bg-teal-100 text-teal-700"
                  }`}
                >
                  <Check size={18} /> TOMAR
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Componente de Formulário (Mantido igual) ---
function AddMedScreen({ onSave, onCancel, initialData }) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("8");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [isContinuous, setIsContinuous] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [generatedTimes, setGeneratedTimes] = useState([]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDosage(initialData.dosage || "");
      setFrequency(initialData.frequency.toString());
      setAmount(initialData.amount || "");
      if (initialData.duration) {
        setDuration(initialData.duration);
        setIsContinuous(false);
      } else {
        setDuration("");
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
    if (isContinuous) setDuration("");
  }, [isContinuous]);

  const calculateSchedule = (start, freq) => {
    const freqNum = Number(freq);
    if (!freqNum || !start) return;
    const [startHour, startMinute] = start.split(":").map(Number);
    const slots = Math.floor(24 / freqNum);
    const times = [];
    for (let i = 0; i < slots; i++) {
      let h = (startHour + i * freqNum) % 24;
      const timeString = `${h.toString().padStart(2, "0")}:${startMinute
        .toString()
        .padStart(2, "0")}`;
      times.push(timeString);
    }
    setGeneratedTimes(times);
  };

  const calculateTotalDoses = () => {
    if (isContinuous) return "Uso Contínuo";
    if (!duration || !frequency) return 0;
    const dosesPerDay = 24 / Number(frequency);
    return Math.ceil(dosesPerDay * Number(duration));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !frequency) return;
    onSave({
      id: initialData ? initialData.id : Date.now(),
      name,
      dosage,
      amount,
      duration: isContinuous ? null : duration ? Number(duration) : null,
      frequency: Number(frequency),
      scheduleTimes: generatedTimes,
    });
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm animate-in slide-in-from-right duration-300 pb-10">
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        {initialData ? "Editar" : "Novo Medicamento"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-2">
            Nome do Remédio
          </label>
          <input
            type="text"
            placeholder="Ex: Amoxicilina"
            className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">
              Gramatura
            </label>
            <input
              type="text"
              placeholder="Ex: 500mg"
              className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 outline-none"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">
              Intervalo
            </label>
            <div className="relative">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none appearance-none font-medium"
              >
                <option value="4">4 em 4h</option>
                <option value="6">6 em 6h</option>
                <option value="8">8 em 8h</option>
                <option value="12">12 em 12h</option>
                <option value="24">1x ao dia</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Clock size={16} />
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">
              Dosagem
            </label>
            <input
              type="text"
              placeholder="Ex: 1 comp"
              className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-slate-500">
                Duração
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="continuous"
                  checked={isContinuous}
                  onChange={(e) => setIsContinuous(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded cursor-pointer"
                />
                <label
                  htmlFor="continuous"
                  className="text-[10px] uppercase font-bold text-teal-600 cursor-pointer"
                >
                  Contínuo
                </label>
              </div>
            </div>
            <input
              type="number"
              placeholder={isContinuous ? "∞" : "Dias"}
              disabled={isContinuous}
              className={`w-full p-4 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 outline-none ${
                isContinuous
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-slate-50"
              }`}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>

        {(isContinuous || (duration && frequency)) && (
          <div className="flex items-center gap-2 text-xs text-teal-600 font-medium bg-teal-50 p-3 rounded-lg">
            <Calendar size={14} />
            {isContinuous ? (
              <span>
                Previsão: <b>Uso Contínuo</b>
              </span>
            ) : (
              <span>
                Total previsto: <b>{calculateTotalDoses()} doses</b>
              </span>
            )}
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <label className="block text-sm font-bold text-teal-700 mb-3 flex items-center gap-2">
            <Clock size={16} /> Horários Diários
          </label>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 font-semibold uppercase ml-1">
                1ª Dose
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {generatedTimes.map((time, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg text-center border ${
                    index === 0
                      ? "bg-teal-100 border-teal-200 text-teal-800"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="text-[10px] block opacity-60 uppercase">
                    {index + 1}ª vez
                  </span>
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
            {initialData ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </div>
  );
}
