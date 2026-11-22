/** Lucide icons (ISC license). Replaces each <i data-lucide="name"> with its SVG. */
import { Camera, ChevronDown, createIcons, Crosshair, Download, FolderOpen, Link, MapPin, RotateCcw, Scissors, Undo2, X } from "lucide";

export function renderIcons() {
  createIcons({
    icons: { Camera, ChevronDown, Crosshair, Download, FolderOpen, Link, MapPin, RotateCcw, Scissors, Undo2, X },
    attrs: { "aria-hidden": "true", "stroke-width": "2" },
  });
}
