-- Fraud/KYC enforcement status, layered on top of trust_tier. trust_tier
-- reflects verification quality; status reflects active enforcement action.
alter table sellers
  add column status text not null default 'active'
    check (status in ('active', 'flagged', 'suspended', 'banned'));

-- Append-only audit log of what tripped enforcement and when. Never cleared,
-- even on admin resolution — resolution adds an entry, it doesn't erase history.
alter table sellers
  add column flags jsonb not null default '[]';

create index sellers_status_idx on sellers(status) where status != 'active';

comment on column sellers.status is
  'active|flagged|suspended|banned. flagged/suspended are proposed automatically (see lib/fraud.ts) and require admin resolution to clear. banned is admin-only, never automatic.';
comment on column sellers.flags is
  'Append-only audit log: [{reason, triggeredAt, action, resolvedAt?, resolvedBy?, resolution?}, ...]';
