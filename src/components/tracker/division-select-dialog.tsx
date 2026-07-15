import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { 
  Briefcase, 
  GraduationCap, 
  Megaphone, 
  Sparkles, 
  Check, 
  Compass 
} from "lucide-react";

interface DivisionSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisions: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isMandatory?: boolean;
}

// ponytail: Memetakan ikon dan gradasi warna yang estetik berdasarkan nama divisi secara dinamis
function getDivisionStyle(name: string) {
  const n = name.toLowerCase();
  if (n.includes("marketing") || n.includes("pasar") || n.includes("humas")) {
    return {
      icon: Megaphone,
      gradient: "from-[#3B82F6] to-[#1D4ED8]", // Blue gradient
      bgLight: "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400",
      glow: "hover:shadow-blue-500/20",
    };
  }
  if (n.includes("pesantren") || n.includes("santri") || n.includes("agama") || n.includes("ibadah") || n.includes("ust")) {
    return {
      icon: Compass,
      gradient: "from-[#10B981] to-[#047857]", // Emerald/Green gradient
      bgLight: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400",
      glow: "hover:shadow-emerald-500/20",
    };
  }
  if (n.includes("ngajar") || n.includes("guru") || n.includes("fasil") || n.includes("didik")) {
    return {
      icon: GraduationCap,
      gradient: "from-[#8B5CF6] to-[#6D28D9]", // Violet gradient
      bgLight: "bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400",
      glow: "hover:shadow-violet-500/20",
    };
  }
  // Default/Lainnya
  return {
    icon: Briefcase,
    gradient: "from-[#EC4899] to-[#BE185D]", // Pink gradient
    bgLight: "bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400",
    glow: "hover:shadow-pink-500/20",
  };
}

export function DivisionSelectDialog({
  open,
  onOpenChange,
  divisions,
  selectedId,
  onSelect,
  isMandatory = false,
}: DivisionSelectDialogProps) {
  
  // Mencegah penutupan jika bersifat mandatory
  const handleOpenChange = (val: boolean) => {
    if (isMandatory) return;
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-md rounded-3xl p-7 border-none bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in fade-in-50 zoom-in-95",
          isMandatory && "[&>button]:hidden" // Sembunyikan tombol close (X) jika wajib pilih
        )}
        onPointerDownOutside={(e) => {
          if (isMandatory) e.preventDefault(); // Cegah klik luar
        }}
        onEscapeKeyDown={(e) => {
          if (isMandatory) e.preventDefault(); // Cegah tombol ESC
        }}
      >
        <DialogHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-soft">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Pilih Divisi Kerja
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {isMandatory 
              ? "Harap pilih divisi kerja terlebih dahulu untuk melihat dan mengisi logbook."
              : "Pilih divisi yang ingin Anda aktifkan saat ini."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3.5 py-5 max-h-[350px] overflow-y-auto pr-1">
          {divisions && divisions.length > 0 ? (
            divisions.map((div) => {
              const isActive = selectedId === div.id;
              const { icon: Icon, gradient, bgLight, glow } = getDivisionStyle(div.name);

              return (
                <button
                  key={div.id}
                  onClick={() => onSelect(div.id)}
                  className={cn(
                    "flex items-center justify-between p-4.5 rounded-2xl border text-left transition-all duration-300 transform hover:-translate-y-0.5",
                    glow,
                    isActive 
                      ? `border-transparent bg-gradient-to-r ${gradient} text-white shadow-lg scale-[1.01]`
                      : "border-slate-200/50 bg-white/45 dark:bg-slate-900/40 hover:bg-slate-100/50 dark:hover:bg-slate-900/80 text-slate-800 dark:text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300",
                      isActive ? "bg-white/20 text-white" : bgLight
                    )}>
                      <Icon className="w-5.5 h-5.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-extrabold text-sm block tracking-wide truncate">{div.name}</span>
                      <span className={cn(
                        "text-[10px] uppercase font-bold tracking-widest block mt-0.5",
                        isActive ? "text-white/60" : "text-slate-400"
                      )}>
                        Workspace
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center animate-scale-in">
                      <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                    </div>
                  )}
                </button>
              );
            })
          ) : (
            <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <Compass className="w-8 h-8 text-slate-350 mx-auto stroke-[1.5px] animate-spin duration-10000" />
              <p className="text-xs text-slate-400 font-semibold mt-3">Tidak ada divisi yang ditugaskan kepada Anda.</p>
              <p className="text-[10px] text-slate-450 mt-1">Harap hubungi Administrator untuk penugasan divisi.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
