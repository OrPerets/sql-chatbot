"use client";

import { useEffect, useRef, useState } from "react";

type FigureMichaelAvatarProps = {
  className?: string;
};

export default function FigureMichaelAvatar({ className }: FigureMichaelAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        containerRef.current.innerHTML = "";

        const { TalkingHead } = await import("../lib/talkinghead/talkinghead.mjs");
        if (!isMounted || !containerRef.current) {
          return;
        }

        const head = new (TalkingHead as any)(containerRef.current, {
          ttsEndpoint: "/api/tts-dummy",
          ttsApikey: "dummy-key",
          ttsVoice: "en-US-Standard-A",
          lipsyncModules: ["en"],
          dracoEnabled: true,
          cameraView: "full",
          modelFPS: 24,
          pixelRatio: 1,
          antialias: false,
          body: "M",
          modelRoot: "Armature",
          audioFilePlayer: false,
          speechSynthesis: false,
          microphoneEnabled: false,
          enableGestures: false,
          enableHeadMovement: true,
          enableEyeBlink: true,
        });

        headRef.current = head;
        await head.showAvatar({
          url: "/michael.glb",
          body: "M",
          avatarMood: "neutral",
        });

        head.onResize?.();
        head.setView?.("full");
        head.lookAtCamera?.(0);

        if (isMounted) {
          setStatus("ready");
        }
      } catch (error) {
        console.error("Figure avatar failed to initialize", error);
        if (isMounted) {
          setStatus("error");
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      try {
        headRef.current?.stop?.();
      } catch (error) {
        console.error("Figure avatar cleanup failed", error);
      }
      headRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
        }}
      />

      {status === "loading" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8a98ad",
            fontSize: "0.95rem",
            background: "linear-gradient(180deg, rgba(255,255,255,0.7), rgba(245,248,252,0.9))",
          }}
        >
          Loading Michael...
        </div>
      ) : null}

      {status === "error" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(245,248,252,0.96))",
          }}
        >
          <div
            style={{
              width: "72%",
              height: "86%",
              borderRadius: "32px",
              background:
                "radial-gradient(circle at 50% 18%, #ffffff 0%, #f4f7fb 44%, #dce5ef 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "9%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "28%",
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                background: "#f3c9b4",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "20%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "26%",
                height: "8%",
                borderRadius: "999px 999px 40% 40%",
                background: "#1f2a3d",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "31%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "42%",
                height: "27%",
                borderRadius: "26% 26% 18% 18%",
                background: "#ffffff",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "56%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "28%",
                height: "26%",
                borderRadius: "24px",
                background: "#283246",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "6%",
                left: "38%",
                width: "12%",
                height: "18%",
                borderRadius: "999px",
                background: "#2a3347",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "6%",
                right: "38%",
                width: "12%",
                height: "18%",
                borderRadius: "999px",
                background: "#2a3347",
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
