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
  const [deviceType, setDeviceType] = useState<"L" | "PC" | "">("");

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
  const submitInventoryRecord = async () => {

    if (!readyToSubmit) {

      return;

    }

    const rawLocation = locationBarcode.trim().toUpperCase();

    let room = rawLocation;

    let building = "";

    // Example:

    // SP2M224-500

    // becomes:

    // Room = 2M-224

    // Building = 500

    // VistA Location = 2M224-500

    const locationMatch = rawLocation.match(/^SP(.+?)-(\d{3})$/);

    if (locationMatch) {

      const roomPart = locationMatch[1];

      building = locationMatch[2];

      const roomMatch = roomPart.match(/^([A-Z]+)(\d{3})$/);

      if (roomMatch) {

        room = `${roomMatch[1]}-${roomMatch[2]}`;

      } else {

        room = roomPart;

      }

    }

    const vistaLocation =

      building

        ? `${room.replace("-", "")}-${building}`

        : rawLocation;

    const record = {

      RecordID: `INV-${Date.now()}`,

      EquipmentBarcode: equipmentBarcode.trim(),

      LocationBarcode: rawLocation,

      Room: room,

      Building: building,

      LocationService: "OI&T",

      DeviceType: deviceType,

      Subtype: "",

      InventoryDateSelection: "T",

      VistaLocation: vistaLocation,

      Status: "PENDING",

    };

    try {

      const json = JSON.stringify(record, null, 2);

      const file = new File(

        [json],

        `${record.RecordID}.json`,

        {

          type: "application/json",

        }

      );

      /*
  
       * PHONE / TABLET
  
       *
  
       * Use the iOS Share Sheet so the
  
       * VIQ Send Shortcut can receive
  
       * the actual JSON file.
  
       */

      const isIOS =

        /iPad|iPhone|iPod/.test(navigator.userAgent) ||

        (navigator.platform === "MacIntel" &&

          navigator.maxTouchPoints > 1);

      if (isIOS && navigator.share) {
        try {
          await navigator.share({
            title: "VIQ Inventory Record",
            text: json,
          });
          console.log(
            "VIQ Inventory JSON:",
            JSON.stringify(record, null, 2)
          );
          setEquipmentBarcode("");
          setError("");
          return;
        } catch (shareError) {
          console.log(
            "Share Sheet failed, falling back to download:",
            shareError
          );
        }
      }

      /*
  
       * COMPUTER / FALLBACK
  
       *
  
       * Download the actual JSON file.
  
       */

      const url = URL.createObjectURL(file);

      const link = document.createElement("a");

      link.href = url;

      link.download = `${record.RecordID}.json`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      console.log(

        "VIQ Inventory JSON:",

        JSON.stringify(record, null, 2)

      );

      setEquipmentBarcode("");

      setError("");

    } catch (err) {

      console.error("VIQ record creation failed:", err);

      setError(

        "Unable to create the inventory record. Please try again."

      );

    }

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
        {/* DEVICE TYPE */}
        <section className="device-type-section">
          <h3>Device Type</h3>
          <div className="device-type-toggle">
            <button
              type="button"
              className={deviceType === "L" ? "selected" : ""}
              onClick={() => setDeviceType("L")}
            >
              Laptop (L)
            </button>
            <button
              type="button"
              className={deviceType === "PC" ? "selected" : ""}
              onClick={() => setDeviceType("PC")}
            >
              Desktop (PC)
            </button>
          </div>
        </section>
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