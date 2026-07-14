// ponytail: Menggunakan Server Functions dari app-config.ts dengan penamaan camelCase sesuai schema Drizzle
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAppConfig, saveAppConfig } from "@/lib/app-config";
import { usePermission } from "@/hooks/use-permission";
import { uploadToRustFS } from "@/lib/storage";

export function BrandingForm() {
  const qc = useQueryClient();
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("branding", "update");
  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const [logoUrl, setLogoUrl] = useState("");
  const [appName, setAppName] = useState("Log Book");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (data) {
      setLogoUrl(data.logoUrl ?? "");
      setAppName(data.appName ?? "Log Book");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveAppConfig({
        data: {
          id: data?.id,
          logoUrl: logoUrl || null,
          appName: appName || "Log Book",
        },
      }),
    onSuccess: () => {
      toast.success("Branding disimpan");
      qc.invalidateQueries({ queryKey: ["app-config"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal menyimpan", { description: e.message }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="surface-card border-0">
      <CardHeader>
        <CardTitle>Branding & Logo</CardTitle>
        <CardDescription>
          Sesuaikan nama aplikasi dan upload logo kustom untuk mempersonalisasi sidebar, halaman login, serta laporan PDF Anda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="app-name">Nama Aplikasi</Label>
          <Input
            id="app-name"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Log Book, Ve-Report, dll."
            required
            disabled={!canUpdate}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold block text-foreground">Upload Logo Aplikasi</Label>
          <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-lg border border-border/60 max-w-md">
            <div className="w-16 h-16 border border-primary/20 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 relative">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-muted-foreground text-xs font-semibold text-center p-1">No Logo</span>
              )}
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setIsUploading(true);
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        try {
                          const res = await uploadToRustFS({
                            base64Data: reader.result as string,
                            fileName: file.name,
                            contentType: file.type || "image/png",
                          });
                          if (res?.url) {
                            setLogoUrl(res.url);
                            toast.success("Logo berhasil di-upload ke S3");
                          }
                        } catch (err: any) {
                          toast.error(err.message || "Gagal mengupload logo ke S3");
                        } finally {
                          setIsUploading(false);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="max-w-[200px]"
                  disabled={!canUpdate || isUploading}
                />
                {logoUrl && canUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogoUrl("")}
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    disabled={isUploading}
                  >
                    Hapus
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Maksimal ukuran file 1MB, format PNG or JPG.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          {canUpdate && (
            <Button onClick={() => save.mutate()} disabled={save.isPending || isUploading}>
              {save.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isUploading ? "Mengupload..." : "Simpan Perubahan"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PdfConfigForm() {
  const qc = useQueryClient();
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("pdf", "update");
  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const [paper, setPaper] = useState("A4");
  const [orientation, setOrientation] = useState("portrait");
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [logLimit, setLogLimit] = useState(200);

  useEffect(() => {
    if (data) {
      setPaper(data.pdfPaperSize ?? "A4");
      setOrientation(data.pdfOrientation ?? "portrait");
      setHeader(data.pdfHeaderText ?? "");
      setFooter(data.pdfFooterText ?? "");
      setLogLimit(data.logLimit ?? 200);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveAppConfig({
        data: {
          id: data?.id,
          pdfPaperSize: paper,
          pdfOrientation: orientation,
          pdfHeaderText: header || null,
          pdfFooterText: footer || null,
          logLimit: logLimit,
        },
      }),
    onSuccess: () => {
      toast.success("Konfigurasi PDF disimpan");
      qc.invalidateQueries({ queryKey: ["app-config"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal menyimpan", { description: e.message }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="surface-card border-0">
      <CardHeader>
        <CardTitle>Konfigurasi PDF</CardTitle>
        <CardDescription>
          Default ukuran, orientasi, header dan footer laporan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ukuran Kertas</Label>
            <Select value={paper} onValueChange={setPaper} disabled={!canUpdate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Orientasi</Label>
            <Select value={orientation} onValueChange={setOrientation} disabled={!canUpdate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Teks Header</Label>
          <Input value={header} onChange={(e) => setHeader(e.target.value)} disabled={!canUpdate} />
        </div>
        <div className="space-y-2">
          <Label>Teks Footer</Label>
          <Textarea
            rows={2}
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            disabled={!canUpdate}
          />
        </div>
        <div className="space-y-2">
          <Label>Batas Jumlah Tampilan Log Terbaru</Label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={logLimit}
            onChange={(e) => setLogLimit(Number(e.target.value))}
            disabled={!canUpdate}
          />
          <p className="text-[10px] text-muted-foreground">
            Batas jumlah baris log kegiatan/sistem terbaru yang dimuat dari database ke layar.
          </p>
        </div>
        <div className="flex justify-end">
          {canUpdate && (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Simpan
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
