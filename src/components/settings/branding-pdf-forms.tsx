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

export function BrandingForm() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    if (data) {
      setLogoUrl(data.logoUrl ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveAppConfig({
        data: {
          id: data?.id,
          logoUrl: logoUrl || null,
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
          Nama aplikasi "Log Book" bersifat permanen. Di sini Anda dapat memperbarui URL logo yang tampil di header laporan PDF dan menu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nama Aplikasi</Label>
          <Input value="Log Book" disabled />
        </div>
        <div className="space-y-2">
          <Label>URL Logo</Label>
          <Input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.png"
          />
          {logoUrl && (
            <div className="mt-2 p-3 rounded-lg surface-panel inline-block">
              <img
                src={logoUrl}
                alt="Preview logo"
                className="h-12 w-auto object-contain"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PdfConfigForm() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const [paper, setPaper] = useState("A4");
  const [orientation, setOrientation] = useState("portrait");
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");

  useEffect(() => {
    if (data) {
      setPaper(data.pdfPaperSize ?? "A4");
      setOrientation(data.pdfOrientation ?? "portrait");
      setHeader(data.pdfHeaderText ?? "");
      setFooter(data.pdfFooterText ?? "");
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
            <Select value={paper} onValueChange={setPaper}>
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
            <Select value={orientation} onValueChange={setOrientation}>
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
          <Input value={header} onChange={(e) => setHeader(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Teks Footer</Label>
          <Textarea
            rows={2}
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
