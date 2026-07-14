-- Tambah kolom baru untuk mendukung Log Book Meeting pada tabel tasks
ALTER TABLE public.tasks 
  ADD COLUMN task_source VARCHAR(20) DEFAULT 'atasan',
  ADD COLUMN output_description TEXT;

-- Tambah kolom baru untuk mendukung Log Book Harian pada tabel tracker_logs
ALTER TABLE public.tracker_logs 
  ADD COLUMN start_time VARCHAR(10) DEFAULT '08:00',
  ADD COLUMN end_time VARCHAR(10) DEFAULT '17:00',
  ADD COLUMN is_validated BOOLEAN DEFAULT false,
  ADD COLUMN validated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN remarks TEXT;
