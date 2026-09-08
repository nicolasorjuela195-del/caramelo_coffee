-- Caramelo Coffee — Cotizaciones y proveedores
-- Copia y pega todo este archivo en Supabase > SQL Editor > New query > Run

create extension if not exists "pgcrypto";

create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text,
  contacto text,
  notas text,
  created_at timestamptz default now()
);

create table if not exists cotizaciones (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null,
  categoria text not null,
  producto text not null,
  precio numeric not null,
  moneda text not null default 'COP',
  fecha date,
  autor text,
  notas text,
  estado text not null default 'pendiente',
  created_at timestamptz default now()
);

-- Seguridad: como es una app interna para el equipo (sin login), dejamos
-- que cualquiera con la llave pública (anon key) pueda leer y escribir.
-- Esa llave queda visible en el código del sitio (es normal en apps sin
-- login), así que no la uses para nada más sensible que esto.
alter table proveedores enable row level security;
alter table cotizaciones enable row level security;

create policy "allow all proveedores" on proveedores
  for all using (true) with check (true);

create policy "allow all cotizaciones" on cotizaciones
  for all using (true) with check (true);

-- Habilita actualizaciones en tiempo real (para que los 3 vean los
-- cambios de los demás sin recargar la página)
alter publication supabase_realtime add table proveedores;
alter publication supabase_realtime add table cotizaciones;
