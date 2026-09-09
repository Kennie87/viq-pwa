import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import "./App.css";
type ScanType = "location" | "equipment";
function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [scanType, setScanType] = useState<ScanType | null>(null);
  const [locationBarcode, setLocationBarcode] =
    useState("");
  const [equipmentBarcode, setEquipmentBarcode] =
    useState("");
  const [manualLocation, setManualLocation] =
    useState("");
  const [manualEquipment, setManualEquipment] =
    useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] =
    useState(false);
  const [locationConfirmed, setLocationConfirmed] =
    useState(false);
  const stopScanner = () => {
    // Stop ZXing
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    // Stop camera stream
    if (videoRef.current?.srcObject) {
      const stream =
        videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
    readerRef.current = null;
    setScanning(false);
    setScanType(null);
  };
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);
  const startScanner = async (type: ScanType) => {
    stopScanner();
    setError("");
    setScanType(type);
    setScanning(true);
    const hints = new Map();
    hints.set(
      DecodeHintType.POSSIBLE_FORMATS,
      [BarcodeFormat.CODE_39]
    );
    const reader =
      new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 250,
      });
    readerRef.current = reader;
    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 100)
      );
      if (!videoRef.current) {
        throw new Error(
          "Camera display could not be initialized."
        );
      }
      const controls =
        await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: {
                ideal: "environment",
              },
              width: {
                ideal: 1920,
              },
              height: {
                ideal: 1080,
              },
            },
          },
          videoRef.current,
          (result) => {
            if (!result) {
              return;
            }
            const value = result
              .getText()
              .trim();
            if (type === "location") {
              setLocationBarcode(value);
              setLocationConfirmed(true);
            }
            if (type === "equipment") {
              setEquipmentBarcode(value);
            }
            stopScanner();
          }
        );
      controlsRef.current = controls;
    } catch (err) {
      console.error(err);
      stopScanner();
      setError(
        err instanceof Error
          ? err.message
          : "Unable to access the camera."
      );
    }
  };
  const useManualLocation = () => {
    const value = manualLocation.trim();
    if (!value) {
      setError(
        "Please enter a location barcode."
      );
      return;
    }
    setLocationBarcode(value);
    setLocationConfirmed(true);
    setManualLocation("");
    setError("");
  };
  const useManualEquipment = () => {
    const value = manualEquipment.trim();
    if (!value) {
      setError(
        "Please enter an equipment barcode."
      );
      return;
    }
    setEquipmentBarcode(value);
    setManualEquipment("");
    setError("");
  };
  const changeLocation = () => {
    setLocationBarcode("");
    setLocationConfirmed(false);
    setEquipmentBarcode("");
    setManualLocation("");
    setError("");
  };
  const clearEquipment = () => {
    setEquipmentBarcode("");
    setManualEquipment("");
    setError("");
  };
  const readyToSubmit =
    locationBarcode.trim() !== "" &&
    equipmentBarcode.trim() !== "";
  const submitInventoryRecord = () => {
 if (!readyToSubmit) {
   return;
 }
 const record = {
   RecordID: `INV-${Date.now()}`,
   EquipmentBarcode: equipmentBarcode.trim(),
   LocationBarcode: locationBarcode.trim(),
   // We will parse these correctly later
   Room: locationBarcode.trim(),
   Building: "",
   // Required VistA field for IT equipment
   LocationService: "OI&T",
   // Optional VistA fields
   DeviceType: "",
   Subtype: "",
   // T = Today
   InventoryDateSelection: "T",
   Status: "PENDING",
 };
 // Convert the VIQ record into a JSON file
 const json = JSON.stringify(record, null, 2);
 const blob = new Blob([json], {
   type: "application/json",
 });
 const url = URL.createObjectURL(blob);
 const link = document.createElement("a");
 link.href = url;
 link.download = `${record.RecordID}.json`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
 console.log("VIQ Inventory JSON:", json);
 // Clear ONLY the equipment.
 // The current location stays active.
 setEquipmentBarcode("");
 setError("");
};

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div>
          <h1>VIQ</h1>
          <p>VistA Inventory Queue</p>
        </div>
      </header>
      <main className="main">
        {/* INTRO */}
        <section className="intro">
          <h2>Inventory Entry</h2>
          <p>
            Set the current location once, then
            scan or enter each piece of equipment.
          </p>
        </section>
        {/* CURRENT LOCATION */}
        <section className="scan-card">
          <div className="scan-header">
            <div>
              <h3>Current Location</h3>
              <p>
                This location stays active until
                you change it.
              </p>
            </div>
            {locationConfirmed && (
              <span className="complete">
                ✓
              </span>
            )}
          </div>
          <div className="value-box">
            {locationBarcode ||
              "No location selected"}
          </div>
          {!locationBarcode && (
            <>
              <button
                className="scan-button"
                onClick={() =>
                  startScanner("location")
                }
                disabled={scanning}
              >
                Scan Location
              </button>
              <div className="manual-entry">
                <label>
                  Or enter location manually
                </label>
                <div className="manual-row">
                  <input
                    type="text"
                    value={manualLocation}
                    onChange={(event) =>
                      setManualLocation(
                        event.target.value
                      )
                    }
                    placeholder="Enter location barcode"
                  />
                  <button
                    className="manual-button"
                    onClick={
                      useManualLocation
                    }
                  >
                    Use
                  </button>
                </div>
              </div>
            </>
          )}
          {locationBarcode && (
            <button
              className="change-location-button"
              onClick={changeLocation}
              disabled={scanning}
            >
              Change Location
            </button>
          )}
        </section>
        {/* EQUIPMENT */}
        <section className="scan-card">
          <div className="scan-header">
            <div>
              <h3>Equipment</h3>
              <p>
                Scan or enter the equipment
                barcode.
              </p>
            </div>
            {equipmentBarcode && (
              <span className="complete">
                ✓
              </span>
            )}
          </div>
          <div className="value-box">
            {equipmentBarcode ||
              "No equipment scanned"}
          </div>
          <button
            className="scan-button"
            onClick={() =>
              startScanner("equipment")
            }
            disabled={
              scanning ||
              !locationBarcode
            }
          >
            Scan Equipment
          </button>
          <div className="manual-entry">
            <label>
              Or enter equipment manually
            </label>
            <div className="manual-row">
              <input
                type="text"
                value={manualEquipment}
                onChange={(event) =>
                  setManualEquipment(
                    event.target.value
                  )
                }
                placeholder="Enter equipment barcode"
              />
              <button
                className="manual-button"
                onClick={
                  useManualEquipment
                }
                disabled={!locationBarcode}
              >
                Use
              </button>
            </div>
          </div>
        </section>
        {/* CAMERA */}
        {scanning && (
          <section className="camera-card">
            <div className="camera-header">
              <h3>
                Scanning{" "}
                {scanType === "location"
                  ? "Location"
                  : "Equipment"}
              </h3>
              <button
                className="cancel-button"
                onClick={stopScanner}
              >
                Cancel
              </button>
            </div>
            <div className="camera-container">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
              />
              <div className="aiming-box" />
            </div>
            <p className="camera-help">
              Position the Code 39 barcode inside
              the box.
            </p>
          </section>
        )}
        {/* ERROR */}
        {error && (
          <section className="error-card">
            <strong>
              Scanner Error
            </strong>
            <p>{error}</p>
          </section>
        )}
        {/* RECORD PREVIEW */}
        <section className="preview-card">
          <h3>
            Record Preview
          </h3>
          <div className="preview-row">
            <span>Location</span>
            <strong>
              {locationBarcode || "—"}
            </strong>
          </div>
          <div className="preview-row">
            <span>Equipment</span>
            <strong>
              {equipmentBarcode || "—"}
            </strong>
          </div>
          <div className="preview-row">
            <span>Status</span>
            <strong>
              PENDING
            </strong>
          </div>
          <button
            className="submit-button"
            disabled={!readyToSubmit}
            onClick={
              submitInventoryRecord
            }
          >
            Submit Inventory Record
          </button>
          {equipmentBarcode && (
            <button
              className="clear-button"
              onClick={clearEquipment}
            >
              Clear Equipment
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
export default App;