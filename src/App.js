import React, { useState, useEffect, useRef } from "react";
// IMPORTANTE: Adicione "lucide-react" na aba "Dependencies" do CodeSandbox para os ícones funcionarem
import {
  Bell,
  Plus,
  Minus,
  Trash2,
  Check,
  Clock,
  Pill,
  ChevronLeft,
  ChevronDown,
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
  Package,
  FileEdit,
  AlertOctagon,
  ShoppingCart,
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

  // Estados de Alarme e Confirmação
  const [activeAlarmMed, setActiveAlarmMed] = useState(null);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState(null);

  const audioRef = useRef(null);

  // --- LÓGICA DE ALERTA DE ESTOQUE (GLOBAL) ---
  const getStockAlert = (med) => {
    if (med.posology === "SOS" || !med.stock || !med.frequency) return null;

    // Dosagem diária
    const doseSize = med.amountNumeric || 1;
    const dosesPerDay = 24 / med.frequency;
    const dailyConsumption = dosesPerDay * doseSize;

    if (dailyConsumption === 0) return null;

    const daysLeft = med.stock / dailyConsumption;

    if (daysLeft <= 3) {
      return Math.ceil(daysLeft);
    }
    return null;
  };

  // Filtros para o Dashboard
  const pendingMeds = meds.filter(
    (med) =>
      !med.isFinished &&
      med.posology !== "SOS" &&
      new Date().getTime() >= med.nextDose
  );
  const lowStockMeds = meds.filter((med) => getStockAlert(med) !== null);

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
          if (
            med.posology === "SOS" ||
            (med.totalDoses && med.takenCount >= med.totalDoses)
          )
            return med;

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
          body: `Está na hora de tomar ${
            formatDosageDisplay(med.amountNumeric) || med.amount
          }.`,
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

  const findNextScheduledDose = (timesArray, frequencyHours) => {
    if (!timesArray || timesArray.length === 0)
      return new Date().getTime() + frequencyHours * 3600000;

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
    const takenCount = editingMed ? editingMed.takenCount || 0 : 0;

    let firstNextDose = null;
    if (medData.posology !== "SOS") {
      firstNextDose = findNextScheduledDose(
        medData.scheduleTimes,
        medData.frequency
      );
    }

    const finalData = {
      ...medData,
      nextDose: firstNextDose,
      notified: false,
      isLate: false,
      totalDoses: medData.totalDoses, // Agora usa o valor calculado no formulário
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

  const requestDelete = (id) => {
    setDeleteConfirmationId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmationId) {
      setMeds(meds.filter((m) => m.id !== deleteConfirmationId));
      setDeleteConfirmationId(null);
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
          // Decrementa estoque usando valor numérico se disponível
          const doseToSubtract = med.amountNumeric || 1;
          const newStock = med.stock
            ? parseFloat(med.stock) - doseToSubtract
            : med.stock;

          let nextTime = null;
          if (med.posology !== "SOS") {
            if (med.frequency > 24) {
              nextTime = new Date().getTime() + med.frequency * 60 * 60 * 1000;
            } else {
              nextTime = findNextScheduledDose(
                med.scheduleTimes,
                med.frequency
              );
            }
          }

          const newTakenCount = (med.takenCount || 0) + 1;
          const isFinished = med.totalDoses && newTakenCount >= med.totalDoses;

          return {
            ...med,
            lastTaken: new Date().getTime(),
            nextDose: nextTime,
            stock: newStock,
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

  // --- AUXILIARES DE FORMATAÇÃO ---
  const formatDosageDisplay = (value) => {
    if (!value) return "";
    if (value === 0.25) return "1/4 do Comprimido";
    if (value === 0.5) return "1/2 Comprimido (Meio)";
    if (value === 1.0) return "1 Comprimido";

    const isInteger = Number.isInteger(value);
    if (isInteger) return `${value} Comprimidos`;

    const integerPart = Math.floor(value);
    return `${integerPart} Comprimido${integerPart > 1 ? "s" : ""} e meio`;
  };

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

        {/* --- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO --- */}
        {deleteConfirmationId && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-sm text-center transform scale-100 animate-in zoom-in-95 duration-200">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Excluir Medicamento?
              </h3>
              <p className="text-slate-500 mb-6">
                Esta ação não pode ser desfeita. O histórico deste remédio será
                apagado.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmationId(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-slate-600 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl bg-red-500 font-bold text-white hover:bg-red-600 shadow-lg shadow-red-500/30"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

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
                    {formatDosageDisplay(activeAlarmMed.amountNumeric) ||
                      activeAlarmMed.amount ||
                      activeAlarmMed.dosage}
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

        {/* Header Dinâmico */}
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

              {/* --- NOVO: ALERTA DE ESTOQUE BAIXO NO DASHBOARD --- */}
              {lowStockMeds.length > 0 && (
                <div
                  onClick={() => setCurrentScreen("list")}
                  className="col-span-2 bg-orange-50 border border-orange-200 p-5 rounded-3xl mb-2 flex items-center gap-4 shadow-sm cursor-pointer hover:bg-orange-100 transition-colors"
                >
                  <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                    <ShoppingCart size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-orange-700 text-lg leading-tight">
                      Repor Estoque
                    </h3>
                    <p className="text-orange-600/80 text-sm font-medium">
                      {lowStockMeds.length}{" "}
                      {lowStockMeds.length === 1
                        ? "medicamento está"
                        : "medicamentos estão"}{" "}
                      acabando.
                    </p>
                  </div>
                  <div className="bg-orange-400 text-white p-2 rounded-full">
                    <ChevronLeft size={20} className="rotate-180" />
                  </div>
                </div>
              )}
              {/* -------------------------------------------------- */}

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
                      Comprimidos
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
                onDelete={requestDelete}
                onEdit={handleEditMed}
                onTake={handleTake}
                onAdd={startNewRegistration}
                formatDosageDisplay={formatDosageDisplay}
                getStockAlert={getStockAlert}
              />
            </div>
          )}

          {/* TELA DE CADASTRO (FORMULÁRIO) */}
          {currentScreen === "add" && (
            <div className="p-4 pb-24">
              <AddMedScreen
                onSave={handleSaveMed}
                onCancel={() => {
                  if (editingMed) setCurrentScreen("list");
                  else setCurrentScreen("select_medication_type");
                }}
                initialData={editingMed}
                formatDosageDisplay={formatDosageDisplay}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTES ---

function HomeScreen({
  meds,
  onDelete,
  onEdit,
  onTake,
  onAdd,
  formatDosageDisplay,
  getStockAlert,
}) {
  // Helper para formatar data/hora no formato "qua., 04 dez. 16:50"
  const formatNextDose = (timestamp) => {
    const date = new Date(timestamp);
    const datePart = date
      .toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
      .replace(" de ", " ");
    const timePart = date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} ${timePart}`;
  };

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
        const isLate =
          !med.isFinished &&
          med.posology !== "SOS" &&
          new Date().getTime() >= med.nextDose;
        const nextDate = new Date(med.nextDose);
        const isContinuous = med.posology === "Contínuo";
        const isSOS = med.posology === "SOS";
        const stockDaysLeft = getStockAlert(med); // Calcula dias restantes de estoque

        let borderClass = "border-teal-500";
        if (med.isFinished)
          borderClass = "border-slate-300 bg-slate-100 opacity-80";
        else if (isSOS) borderClass = "border-orange-400";
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

                  {med.amountNumeric ? (
                    <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded">
                      {formatDosageDisplay(med.amountNumeric)}
                    </span>
                  ) : (
                    med.amount && (
                      <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded">
                        {med.amount}
                      </span>
                    )
                  )}

                  {isSOS ? (
                    <span className="text-orange-500">• S.O.S</span>
                  ) : (
                    <span>• {med.frequency}h</span>
                  )}
                </div>

                {/* Estoque + Alerta de Estoque */}
                <div className="flex flex-col gap-1 mt-2">
                  {med.stock && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Package size={12} /> Restam {med.stock} na caixa
                    </div>
                  )}

                  {/* --- ALERTA VISUAL DE ESTOQUE BAIXO NO CARTÃO --- */}
                  {stockDaysLeft !== null && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md w-fit animate-pulse">
                      <ShoppingCart size={12} />
                      <span>
                        Acaba em {stockDaysLeft} dia
                        {stockDaysLeft > 1 ? "s" : ""}. Repor estoque!
                      </span>
                    </div>
                  )}
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
              {isSOS ? (
                <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">
                  <AlertCircle size={12} /> Se necessário
                </div>
              ) : isContinuous ? (
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
                ) : isSOS ? (
                  <div className="text-orange-500 text-xs font-bold">
                    Tomar quando sentir dor/sintoma
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
                      <span className="font-bold text-sm">
                        {isLate ? "AGORA" : formatNextDose(med.nextDose)}
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

// --- Componente de Formulário (ATUALIZADO) ---
function AddMedScreen({ onSave, onCancel, initialData, formatDosageDisplay }) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [stock, setStock] = useState("");
  const [posology, setPosology] = useState("");
  const [amount, setAmount] = useState("");

  // NOVO: Estado Numérico para o Stepper
  const [amountNumeric, setAmountNumeric] = useState(1.0);

  const [treatType, setTreatType] = useState("");
  const [duration, setDuration] = useState("");
  const [customDays, setCustomDays] = useState([]);

  const [frequency, setFrequency] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [notes, setNotes] = useState("");
  const [generatedTimes, setGeneratedTimes] = useState([]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDosage(initialData.dosage || "");
      setStock(initialData.stock || "");
      setPosology(initialData.posology || "Tratamento");
      setAmount(initialData.amount || "");
      setTreatType(initialData.treatType || "Todos os dias");
      setDuration(initialData.duration || "");
      setCustomDays(initialData.customDays || []);
      setFrequency(String(initialData.frequency || "8"));
      setNotes(initialData.notes || "");
      if (initialData.amountNumeric) {
        setAmountNumeric(initialData.amountNumeric);
      }
      if (initialData.scheduleTimes && initialData.scheduleTimes.length > 0) {
        setStartTime(initialData.scheduleTimes[0]);
      }
    }
  }, [initialData]);

  // Recalcula horários
  useEffect(() => {
    if (posology === "SOS") {
      setGeneratedTimes([]);
      return;
    }
    const freqNum = Number(frequency);
    if (!freqNum || !startTime) return;

    if (
      posology === "Contínuo" ||
      (posology === "Tratamento" && treatType === "Todos os dias")
    ) {
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const slots = Math.floor(24 / freqNum);
      const times = [];
      for (let i = 0; i < slots; i++) {
        let h = (startHour + i * freqNum) % 24;
        const timeString = `${String(h).padStart(2, "0")}:${String(
          startMinute
        ).padStart(2, "0")}`;
        times.push(timeString);
      }
      setGeneratedTimes(times);
    } else {
      setGeneratedTimes([startTime]);
    }
  }, [frequency, startTime, posology, treatType]);

  const toggleCustomDay = (day) => {
    if (customDays.includes(day)) {
      setCustomDays(customDays.filter((d) => d !== day));
    } else {
      setCustomDays([...customDays, day]);
    }
  };

  // --- Lógica do Stepper de Dosagem ---
  const handleDecrement = () => {
    if (amountNumeric <= 0.25) return;

    if (amountNumeric === 0.5) {
      setAmountNumeric(0.25);
    } else if (amountNumeric === 1.0) {
      setAmountNumeric(0.5);
    } else {
      setAmountNumeric(amountNumeric - 0.5);
    }
  };

  const handleIncrement = () => {
    if (amountNumeric === 0.25) {
      setAmountNumeric(0.5);
    } else if (amountNumeric === 0.5) {
      setAmountNumeric(1.0);
    } else {
      setAmountNumeric(amountNumeric + 0.5);
    }
  };

  // Verifica se é fracionado (tem resto na divisão por 1)
  const isFraction = amountNumeric % 1 !== 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !posology) return;
    if (posology !== "SOS" && !frequency) return;

    let finalFrequency = Number(frequency);
    if (posology === "Tratamento") {
      if (treatType === "Todas as semanas") finalFrequency = 168;
      if (treatType === "Todos os meses") finalFrequency = 720;
      if (treatType === "Todos os anos") finalFrequency = 8760;
    }

    // Calcula totalDoses
    let total = null;
    if (posology === "Tratamento" && duration && frequency) {
      let durationInHours = 0;
      if (treatType === "Todos os dias") durationInHours = duration * 24;
      else if (treatType === "Todas as semanas")
        durationInHours = duration * 168;
      else if (treatType === "Todos os meses") durationInHours = duration * 720;
      else if (treatType === "Todos os anos") durationInHours = duration * 8760;

      if (durationInHours > 0) {
        total = Math.ceil(durationInHours / finalFrequency);
      }
    }

    onSave({
      id: initialData ? initialData.id : Date.now(),
      name,
      dosage,
      stock,
      posology,
      amount: formatDosageDisplay(amountNumeric),
      amountNumeric,
      treatType,
      duration,
      customDays,
      frequency: finalFrequency,
      scheduleTimes: generatedTimes,
      totalDoses: total, // Salva o total calculado
      notes,
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
            Nome do medicamento
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
              Concentração
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
              Qtd na Caixa
            </label>
            <input
              type="number"
              placeholder="Ex: 30"
              className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 outline-none"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-4 mt-4">
          Posologia
        </h3>

        <div>
          <label className="block text-sm font-bold text-slate-500 mb-2">
            Como será o uso do medicamento
          </label>
          <div className="relative">
            <select
              value={posology}
              onChange={(e) => setPosology(e.target.value)}
              className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none appearance-none"
            >
              <option value="" disabled hidden>
                Selecione...
              </option>
              <option value="Contínuo">Contínuo</option>
              <option value="Tratamento">Tratamento</option>
              <option value="SOS">S.O.S</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-start">
          {/* --- COMPONENTE DE DOSAGEM COM STEPPER --- */}
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">
              Dosagem
            </label>
            <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200 h-[56px]">
              <button
                type="button"
                onClick={handleDecrement}
                className="w-10 h-full flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-white rounded-lg transition-all disabled:opacity-30"
                disabled={amountNumeric <= 0.25}
              >
                <Minus size={20} />
              </button>

              <div className="flex-1 text-center flex items-center justify-center px-1">
                <span className="text-xs font-bold text-slate-700 leading-tight">
                  {formatDosageDisplay(amountNumeric)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleIncrement}
                className="w-10 h-full flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-white rounded-lg transition-all"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* --- Interval (Always visible) --- */}
          <div>
            <label className="block text-sm font-bold text-slate-500 mb-2">
              Intervalo entre doses
            </label>
            <div className="relative">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none appearance-none"
              >
                <option value="" disabled hidden>
                  Selecione...
                </option>
                <option value="4">4 em 4h</option>
                <option value="6">6 em 6h</option>
                <option value="8">8 em 8h</option>
                <option value="12">12 em 12h</option>
                <option value="24">1x ao dia</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>
        </div>

        {/* --- ALERTA DE SEGURANÇA (Fracionados) --- */}
        {isFraction && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertTriangle className="text-orange-500 shrink-0" size={20} />
            <p className="text-xs text-orange-700 font-medium leading-snug">
              <b>Atenção:</b> Apenas comprimidos sulcados (com risco no meio)
              podem ser partidos. Nunca parta cápsulas, drágeas ou comprimidos
              de liberação prolongada.
            </p>
          </div>
        )}

        {/* --- Frequency & Duration (Only if Tratamento) --- */}
        {posology === "Tratamento" && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-sm font-bold text-slate-500 mb-2">
                Frequência
              </label>
              <div className="relative">
                <select
                  value={treatType}
                  onChange={(e) => setTreatType(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none appearance-none"
                >
                  <option value="" disabled hidden>
                    Selecione...
                  </option>
                  <option>Todos os dias</option>
                  <option>Todas as semanas</option>
                  <option>Todos os meses</option>
                  <option>Todos os anos</option>
                  <option>Personalizar...</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            {/* Duration (Hidden if Custom) */}
            {treatType !== "Personalizar..." && (
              <div>
                <label className="block text-sm font-bold text-teal-700 mb-2">
                  Duração
                </label>
                <input
                  type="number"
                  placeholder="Ex: 7"
                  className="w-full p-4 bg-slate-50 border-none rounded-xl outline-none focus:border-teal-500"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* --- Custom Days --- */}
        {posology === "Tratamento" && treatType === "Personalizar..." && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in slide-in-from-top">
            <label className="block text-sm font-bold text-teal-700 mb-3 flex items-center gap-2">
              <Calendar size={16} /> Escolha os dias (Mês)
            </label>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleCustomDay(day)}
                  className={`p-2 text-xs rounded-lg font-bold transition-colors ${
                    customDays.includes(day)
                      ? "bg-teal-600 text-white"
                      : "bg-white text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- Horários (Visible only if interval selected) --- */}
        {posology !== "SOS" && frequency && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in slide-in-from-top">
            <label className="block text-sm font-bold text-teal-700 mb-3 flex items-center gap-2">
              <Clock size={16} /> Horários
            </label>

            <div>
              <label className="block text-sm font-bold text-slate-500 mb-2">
                Horário {posology === "Contínuo" ? "Inicial" : "da Dose"}
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>

            {/* Mostra horários calculados apenas se for diário */}
            {(posology === "Contínuo" ||
              (posology === "Tratamento" && treatType === "Todos os dias")) &&
              generatedTimes.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {generatedTimes.map((time, index) => (
                    <div
                      key={index}
                      className="text-[10px] bg-white border rounded p-1 text-center font-bold text-slate-600"
                    >
                      {time}
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-slate-500 mb-2">
            Observações
          </label>
          <textarea
            placeholder="Ex: Tomar após as refeições"
            className="w-full p-4 bg-slate-50 border-none rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 outline-none resize-none h-24"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          ></textarea>
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
            {initialData ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
