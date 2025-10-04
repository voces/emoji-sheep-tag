import React, { useEffect, useState } from "react";
import { renderer } from "../../graphics/three.ts";

const DISMISSED_KEY = "emoji-sheep-tag-gpu-warning-dismissed";

type GPUInfo = {
  renderer: string;
  vendor: string;
  isSoftwareRenderer: boolean;
};

const useGPUDetection = (): GPUInfo | null => {
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);

  useEffect(() => {
    if (!renderer) return;

    const gl = renderer.getContext();
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

    if (debugInfo) {
      const rendererInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      const vendorInfo = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

      const isSoftwareRenderer =
        /swiftshader|llvmpipe|mesa|software|microsoft basic/i.test(
          rendererInfo,
        );

      setGpuInfo({
        renderer: rendererInfo,
        vendor: vendorInfo,
        isSoftwareRenderer,
      });

      if (isSoftwareRenderer) console.warn("⚠️ Software rendering detected!");
    }
  }, []);

  return gpuInfo;
};

export const PerformanceWarning: React.FC = () => {
  const gpuInfo = useGPUDetection();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Clear dismissal if hardware rendering is now active
    if (gpuInfo && !gpuInfo.isSoftwareRenderer) {
      localStorage.removeItem(DISMISSED_KEY);
      return;
    }

    // Check if previously dismissed
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, [gpuInfo]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  if (!gpuInfo?.isSoftwareRenderer || isDismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#ff6b6b",
        color: "white",
        padding: "16px 24px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 10000,
        maxWidth: "600px",
        textAlign: "center",
        textShadow: "none",
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "none",
          border: "none",
          color: "white",
          fontSize: "20px",
          cursor: "pointer",
          padding: "4px 8px",
          lineHeight: "1",
          opacity: 0.7,
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
        onMouseLeave={(e) => e.currentTarget.style.opacity = "0.7"}
      >
        ×
      </button>
      <div style={{ fontSize: "24px", marginBottom: "8px" }}>⚠️</div>
      <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
        Software Rendering Detected
      </div>
      <div style={{ fontSize: "14px", marginBottom: "12px" }}>
        Your browser is using software rendering, which causes poor performance.
      </div>
      <div
        style={{
          fontSize: "12px",
          marginBottom: "12px",
          textAlign: "left",
          lineHeight: "1.5",
        }}
      >
        <strong>How to fix:</strong>
        <br />
        1. Enable hardware acceleration in browser settings
        <br />
        2. Update your graphics drivers
        <br />
        3. Try Chrome or Firefox
      </div>
      <a
        href="https://www.howtogeek.com/412738/how-to-turn-hardware-acceleration-on-and-off-in-chrome/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          backgroundColor: "white",
          color: "#ff6b6b",
          padding: "8px 16px",
          borderRadius: "4px",
          textDecoration: "none",
          fontWeight: "bold",
          fontSize: "14px",
        }}
      >
        See Instructions
      </a>
      <div style={{ fontSize: "10px", marginTop: "8px", opacity: 0.8 }}>
        GPU: {gpuInfo.renderer}
      </div>
    </div>
  );
};
