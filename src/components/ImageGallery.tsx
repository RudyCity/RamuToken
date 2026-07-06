import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Image,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PipelineStep } from "../types";

export interface ImageGalleryProps {
  step: PipelineStep;
}

export default function ImageGallery({ step }: ImageGalleryProps) {
  const images = step.images || [];
  const format = step.imageFormat || "png";
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);

  // Zoom and Pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const openLightbox = useCallback((idx: number) => {
    setLightboxIndex(idx);
    resetZoom();
  }, [resetZoom]);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    resetZoom();
  }, [resetZoom]);

  const prevImage = useCallback(() => {
    setLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
    resetZoom();
  }, [resetZoom]);

  const nextImage = useCallback(() => {
    setLightboxIndex(prev => (prev !== null && prev < images.length - 1 ? prev + 1 : prev));
    resetZoom();
  }, [images.length, resetZoom]);

  // Keyboard navigation, body scroll lock, and native non-passive wheel zoom
  useEffect(() => {
    if (lightboxIndex === null) return;

    // Lock body scrollbar
    document.body.style.overflow = "hidden";

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevImage();
      else if (e.key === "ArrowRight") nextImage();
      else if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handler);

    // Native non-passive wheel event listener to override page scrolling
    const element = lightboxRef.current;
    const nativeWheelHandler = (e: WheelEvent) => {
      e.preventDefault(); // Lock browser scrolling bubble
      if (e.deltaY < 0) {
        setScale(prev => Math.min(prev + 0.25, 4));
      } else {
        setScale(prev => {
          const next = Math.max(prev - 0.25, 1);
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      }
    };

    if (element) {
      element.addEventListener("wheel", nativeWheelHandler, { passive: false });
    }

    return () => {
      window.removeEventListener("keydown", handler);
      if (element) {
        element.removeEventListener("wheel", nativeWheelHandler);
      }
      // Restore body scrollbar
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, prevImage, nextImage, closeLightbox]);

  const downloadImage = useCallback((idx: number) => {
    const link = document.createElement("a");
    const src = images[idx];
    link.href = src.startsWith("data:") || src.startsWith("http") || src.startsWith("/api/")
      ? src
      : `data:image/${format};base64,${src}`;
    link.download = `image-step-page-${idx + 1}.${format}`;
    link.click();
  }, [images, format]);

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  }, [scale, resetZoom]);

  // Drag (panning) handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart, scale]);

  const handleMouseUpOrLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || scale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  }, [isDragging, dragStart, scale]);

  if (images.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mt-1">
      {/* Gallery Header */}
      <div className="flex items-center gap-2">
        <Image className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-violet-300 font-mono">
          Image Gallery
        </span>
        <span className="text-[9px] font-mono text-slate-500 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">
          {images.length} page{images.length !== 1 ? "s" : ""} • {format.toUpperCase()}
        </span>
      </div>

      {/* Thumbnail Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {images.map((b64, idx) => (
          <div
            key={idx}
            onClick={() => openLightbox(idx)}
            className="group relative aspect-video bg-slate-950 border border-white/8 rounded-xl overflow-hidden cursor-pointer hover:border-violet-500/50 hover:shadow-[0_0_16px_rgba(139,92,246,0.2)] transition-all"
          >
            <img
              src={b64.startsWith("data:") || b64.startsWith("http") || b64.startsWith("/api/") ? b64 : `data:image/${format};base64,${b64}`}
              alt={`Image page ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-violet-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
              <ZoomIn className="w-4 h-4 text-white" />
              <span className="text-[9px] font-mono text-white font-bold">Page {idx + 1}</span>
            </div>
            {/* Page badge */}
            <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1.5 py-0.5 text-[8px] font-mono text-slate-300">
              {idx + 1}/{images.length}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox rendered via Portal to escape parent container CSS transform boundary */}
      {lightboxIndex !== null && createPortal(
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Top bar */}
          <div
            className="absolute top-4 left-0 right-0 flex items-center justify-between px-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-bold text-white font-mono">
                Page {lightboxIndex + 1} of {images.length}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{format.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 mr-2">
                <button
                  onClick={handleZoomOut}
                  disabled={scale <= 1}
                  title="Zoom Out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono text-slate-300 px-2 min-w-[45px] text-center select-none">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={scale >= 4}
                  title="Zoom In"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                {scale > 1 && (
                  <button
                    onClick={resetZoom}
                    title="Reset Zoom"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 border-l border-white/10 transition-all cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                onClick={() => downloadImage(lightboxIndex)}
                title="Download image"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-all cursor-pointer text-[10px] font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                onClick={closeLightbox}
                title="Close (Esc)"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main image container */}
          <div
            className="relative max-w-5xl max-h-[80vh] w-full mx-6 overflow-hidden flex items-center justify-center rounded-2xl select-none"
            onClick={e => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUpOrLeave}
            onDoubleClick={handleDoubleClick}
            style={{
              cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default"
            }}
          >
            <img
              src={images[lightboxIndex].startsWith("data:") || images[lightboxIndex].startsWith("http") || images[lightboxIndex].startsWith("/api/")
                ? images[lightboxIndex]
                : `data:image/${format};base64,${images[lightboxIndex]}`}
              alt={`Image page ${lightboxIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-[0_0_60px_rgba(139,92,246,0.15)] border border-white/10 select-none pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.15s ease-out"
              }}
            />
          </div>

          {/* Navigation arrows */}
          <div
            className="absolute left-0 right-0 flex items-center justify-between px-4 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <button
              onClick={e => { e.stopPropagation(); prevImage(); }}
              disabled={lightboxIndex === 0}
              className="pointer-events-auto p-2 rounded-full bg-black/50 border border-white/10 text-white hover:bg-violet-600/40 hover:border-violet-500/50 transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); nextImage(); }}
              disabled={lightboxIndex === images.length - 1}
              className="pointer-events-auto p-2 rounded-full bg-black/50 border border-white/10 text-white hover:bg-violet-600/40 hover:border-violet-500/50 transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div
              className="absolute bottom-4 flex items-center gap-2 bg-black/60 rounded-2xl border border-white/10 p-2"
              onClick={e => e.stopPropagation()}
            >
              {images.map((b64, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightboxIndex(idx)}
                  className={`w-12 h-8 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    idx === lightboxIndex
                      ? "border-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                      : "border-transparent hover:border-white/30"
                  }`}
                >
                  <img
                    src={b64.startsWith("data:") || b64.startsWith("http") || b64.startsWith("/api/") ? b64 : `data:image/${format};base64,${b64}`}
                    alt={`thumb ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
