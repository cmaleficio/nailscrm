# Graph Report - nails  (2026-09-28)

## Corpus Check
- 292 files · ~280,369 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2280 nodes · 4615 edges · 148 communities (124 shown, 24 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 286 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Endpoints API del dashboard
- Páginas admin y adaptador Drizzle
- Permisos, navegación y cuentas por cobrar
- API de compras, inventario y financieros
- Rutas de perfil y reserva
- Migraciones base del esquema
- Uso de inventario por cita y agotado
- Fotos de citas, galería y servicios
- Diálogos de agenda y tasas
- Pruebas de authz y del visor
- Módulo de log de actividad
- Wizard de reserva
- Esquema Drizzle de tablas
- Módulo legal y política de privacidad
- Portal del cliente
- Muro de inspiración y producción
- Ajustes de costo de inventario
- Tasas BCV, cron y utils
- Handlers de rutas API y auditoría
- Configuración de TypeScript
- Archivo de producción de fotos
- Ajustes legales singleton
- Cursos grupales y CXC por alumno
- Dependencias de desarrollo
- RISC y utilidades de sistema
- Handlers de rutas API y auditoría
- Pagos y estado financiero del cliente
- Visor de fotos y muro prellenado
- CRM de clientes y servicios
- Tablas de pagos y facturas
- Script de rebuild de graphify
- UI de cuentas por cobrar
- Rutas admin y registro de uso
- Seed de datos financieros
- Stack, autenticación y lista de espera
- Cuentas por pagar y P&L
- Agenda del día y semana
- Seguridad de dependencias y BCV
- Validación de subidas por magic bytes
- Dependencias de producción
- Eliminación de clientes y servicios
- Sesiones de curso
- Scripts npm
- Header y layouts públicos
- Pruebas jsdom del visor
- Servicio realizado y citas pendientes
- Permisos por administrador
- MVP de reserva y muro
- UI de cuentas por pagar
- Capturas de pago y códigos
- Categorías de esmalte y agotado
- Cancelación hard-delete y reseñas
- Estado financiero de compras
- Edición de costo y saldo del CRM
- Página de política de privacidad
- Landing pública y reseñas
- Pasaporte de uñas del CRM
- UI de compras
- Utilidades del archivo de producción
- Disponibilidad y slots
- Tablas de Auth.js y RISC
- Layout admin y filtrado de permisos
- Handlers de rutas API y auditoría
- Seed de datos demo
- Endpoints de inventario y recetas
- UI de inventario
- UI de inventario
- Sincronización con Google Calendar
- Condiciones de servicio
- Búsqueda sin acentos y archivo
- Compras sin cita y cursos
- Roles y promoción de admins
- Movimientos de stock y recetas
- Layout raíz y sesión
- Configuración de NextAuth
- Enlace de cuenta Google
- Endpoints de tasa BCV
- Fotos de cita y pasaporte
- Disponibilidad, slots y zona horaria
- Cancelación y archivo
- Sidebar, OAuth y WhatsApp
- Escritura best-effort en Calendar
- CRM y tarjetas de servicio
- Editor de permisos de admins
- Formulario de login
- Plan MVP de 6 fases
- Seguridad de subidas
- CXC desde el agendado
- Permisos granulares por módulo
- Pruebas de auditoría y conexión
- Agenda del día y semana
- Diseño MVP de 5 tablas
- Overrides de dependencias
- Página de actividad y guardas
- UI de inventario
- UI de servicios
- MVP de panel y permisos
- Estrategia de verificación
- Slots, blockouts y horario
- API de cuentas por cobrar
- UI de actividad y condiciones
- Editor de navegación pública
- Helpers de Calendar por cita
- Esquema del P&L
- Editor de horario
- Reprogramar citas
- Formulario legal del admin
- UI de actividad y condiciones
- API de ajustes legales
- API de condiciones de servicio
- API de ajustes de marca
- Diálogos de blockout
- Feature de audit log
- Fotos de cita 1:N
- Guardas de Patch de cita
- API de administradores
- Kardex y costo promedio
- Configuración de ESLint
- Editor de permisos de admins
- UI de inventario
- Seed base de datos
- Scraper de la tasa BCV
- Scripts de seed y comandos
- Reparacion de dependencias externas
- Navegación pública editable
- Tabla legal_settings
- Migración brand_settings
- Migración nav_items
- Migración risc_events
- Configuración de Drizzle Kit
- Dependencia tsx
- Tipos de React DOM
- Configuración de PostCSS
- Skill graphify
- Reglas de PowerShell en Windows
- Formulario de registro completo
- Nodo LoginForm
- Servicios ordenados por precio
- Spec de muro y CRM
- Spec de walk-ins y horario
- Spec de borrado duro
- Feature de compras
- Ruta aislada

## God Nodes (most connected - your core abstractions)
1. `hasPermission()` - 161 edges
2. `logActivity()` - 115 edges
3. `db` - 87 edges
4. `drizzle/orm` - 84 edges
5. `next/server` - 70 edges
6. `Plan: citas admin walk-ins, horario de trabajo, cuentas por cobrar y pagos` - 44 edges
7. `react` - 44 edges
8. `todayStr()` - 25 edges
9. `next/navigation` - 25 edges
10. `PhotoLightbox()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Admin Pre-seeding of the Gallery Wall (gallery_photos)` --semantically_similar_to--> `appointment_photos 1:N Table`  [INFERRED] [semantically similar]
  todo.md → docs/superpowers/plans/2026-08-02-admin-calendar-bugs.md
- `Feature: admin nail passport (finished work carousel)` --semantically_similar_to--> `All final photos in the client portal`  [INFERRED] [semantically similar]
  README.md → CHANGELOG.md
- `Fail-closed reading of stored admin permissions` --semantically_similar_to--> `Feature: per-admin module permissions with fail-closed parsing`  [INFERRED] [semantically similar]
  CHANGELOG.md → README.md
- `src/lib modules (auth, authz, calendar, slots, availability, time, bcv, zoom, download-name)` --references--> `src/lib/download-name.ts (slugified download name)`  [INFERRED]
  README.md → CHANGELOG.md
- `src/lib modules (auth, authz, calendar, slots, availability, time, bcv, zoom, download-name)` --references--> `src/lib/bcv.ts (refreshTodayRate, backfillMissingRates)`  [INFERRED]
  README.md → CHANGELOG.md

## Import Cycles
- 1-file cycle: `drizzle.config.ts -> drizzle.config.ts`
- 1-file cycle: `eslint.config.mjs -> eslint.config.mjs`
- 1-file cycle: `next.config.ts -> next.config.ts`
- 1-file cycle: `scripts/apply-risc-migration.ts -> scripts/apply-risc-migration.ts`
- 1-file cycle: `scripts/register-risc.ts -> scripts/register-risc.ts`
- 1-file cycle: `src/app/(admin)/dashboard/DashboardContent.tsx -> src/app/(admin)/dashboard/DashboardContent.tsx`
- 1-file cycle: `src/app/(admin)/dashboard/accounts-payable/page.tsx -> src/app/(admin)/dashboard/accounts-payable/page.tsx`
- 1-file cycle: `src/lib/auth.ts -> src/lib/auth.ts`
- 1-file cycle: `src/app/(admin)/dashboard/brand/BrandContent.tsx -> src/app/(admin)/dashboard/brand/BrandContent.tsx`
- 1-file cycle: `src/app/(admin)/dashboard/settings/navigation/NavEditorContent.tsx -> src/app/(admin)/dashboard/settings/navigation/NavEditorContent.tsx`
- 1-file cycle: `src/app/(client)/complete-registration/page.tsx -> src/app/(client)/complete-registration/page.tsx`
- 1-file cycle: `src/db/index.ts -> src/db/index.ts`
- 1-file cycle: `src/app/(public)/login/LoginForm.tsx -> src/app/(public)/login/LoginForm.tsx`
- 1-file cycle: `src/app/api/activity-logs/actors/route.ts -> src/app/api/activity-logs/actors/route.ts`
- 1-file cycle: `src/app/api/appointments/[id]/final-photos/route.ts -> src/app/api/appointments/[id]/final-photos/route.ts`
- 1-file cycle: `src/app/api/auth/register/route.ts -> src/app/api/auth/register/route.ts`
- 1-file cycle: `src/app/api/exchange-rate/backfill/route.ts -> src/app/api/exchange-rate/backfill/route.ts`
- 1-file cycle: `src/lib/bcv.ts -> src/lib/bcv.ts`
- 1-file cycle: `src/app/layout.tsx -> src/app/layout.tsx`
- 1-file cycle: `src/components/PhotoLightbox.test.tsx -> src/components/PhotoLightbox.test.tsx`

## Hyperedges (group relationships)
- **Shared photo viewing stack (viewer + zoom math + download naming + tests)** — changelog_photolightbox, changelog_zoom, changelog_download_name, changelog_photothumb, changelog_photocarousel, changelog_photolightbox_test, changelog_lightbox_render_tests [EXTRACTED 1.00]
- **Independent configuration permissions end to end (keys, parsing, SSR nav)** — changelog_split_settings_permissions, changelog_permissions_lib, changelog_authz_lib, changelog_adminshell, changelog_admin_layout, changelog_permissions_read_policy, readme_feature_split_settings [EXTRACTED 1.00]
- **Accent/case-insensitive search reused across modules** — changelog_balances_search, changelog_inventory_search, changelog_production_archive, changelog_fold_search, readme_feature_balances, readme_feature_inventory [INFERRED 0.85]
- **Cadena de autorizacion de permisos de admin** — agents_permission_keys, agents_parse_stored_permissions, agents_get_permissions, agents_has_permission, agents_has_any_permission, agents_adminshell, agents_api_my_permissions [EXTRACTED 1.00]
- **Flujo de reporte y aprobacion de pagos de clienta** — agents_report_payment_dialog, agents_api_payment_receipts, agents_payment_receipts, agents_payments, agents_recompute_financial_status, agents_apply_paid_to_client [EXTRACTED 1.00]
- **Archivo de produccion de fotos (endpoint, UI y helpers de fecha)** — agents_api_production_photos, agents_production_tab, agents_gallery_content, agents_day_key_from_timestamp, agents_build_production_caption, agents_photo_download_name, agents_photolightbox [EXTRACTED 1.00]
- **Google Calendar Push Sync Pipeline** — docs_superpowers_plans_2026_08_02_admin_calendar_bugs_google_calendar_lib, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_get_valid_access_token, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_create_event_on_primary_calendar, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_update_event_on_primary_calendar, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_delete_event_on_primary_calendar, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_appointment_calendar_helpers, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_calendar_sync_wiring, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_google_event_id_columns [EXTRACTED 1.00]
- **Admin Access Control Model** — todo_permission_system, todo_permission_guard_audit, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_multi_admin_system, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_authz_helpers, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_dashboard_authorization_by_role, docs_superpowers_plans_2026_08_02_admin_calendar_bugs_admins_api, docs_superpowers_plans_2026_08_09_cancel_hard_delete_delete_appointments_endpoint [INFERRED 0.85]
- **Flujo de publicación de fotos finales al muro** — docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_completeappointmentdialog, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_api_appointments_patch, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_schema_appointmentphotos, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_api_gallery_get, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_gallerygrid, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_inspiration_wall [EXTRACTED 1.00]
- **Ciclo de vida de las fotos de servicio (subida → service_photos → carrusel del home)** — docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_servicescontent, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_api_upload, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_api_services_photos_post, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_schema_servicephotos, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_servicecard, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_public_page [EXTRACTED 1.00]
- **Datos de contacto del cliente: alta admin, edición en CRM y autoregistro** — docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_api_clients_getpost, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_api_clients_patch, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_clientcrmpanel, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_clientscontent, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_api_profile_patch, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_completeregistrationform, docs_superpowers_plans_2026_08_07_gallery_crm_service_photos_complete_registration_flow [EXTRACTED 1.00]
- **Flujo de creacion de cita para walk-in desde la agenda** — docs_superpowers_plans_2026_08_08_admin_appointments_receivables_new_appointment_dialog, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_api_clients_route, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_api_slots_route, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_api_appointments_route, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_validate_slot, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_walk_in_appointments, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_dashboard_content [EXTRACTED 1.00]
- **Horario configurable: tabla -> lib -> generateSlots -> slots y editor de config** — docs_superpowers_plans_2026_08_08_admin_appointments_receivables_working_hours_table, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_working_hours_lib, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_get_working_hours_for_date, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_slots_lib, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_generate_slots, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_api_slots_route, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_api_working_hours_route, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_settings_content [INFERRED 0.95]
- **CXC: saldo en vivo sobre snapshots, pagos USD/Bs y tasa BCV** — docs_superpowers_plans_2026_08_08_admin_appointments_receivables_accounts_receivable_feature, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_payments_table, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_service_purchases_table, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_live_balance_calculation, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_api_payments_route, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_api_balances_route, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_balances_content, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_register_payment_dialog, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_exchange_rates_table, docs_superpowers_plans_2026_08_08_admin_appointments_receivables_get_today_rate [INFERRED 0.85]
- **Hard Delete Cancellation Flow (admin + client)** — docs_superpowers_plans_2026_08_09_cancel_hard_delete_hard_delete_cancellation, docs_superpowers_plans_2026_08_09_cancel_hard_delete_cancelled_appointments_table, docs_superpowers_plans_2026_08_09_cancel_hard_delete_delete_appointments_endpoint, docs_superpowers_plans_2026_08_09_cancel_hard_delete_patch_cancelled_guard, docs_superpowers_plans_2026_08_09_cancel_hard_delete_cancelled_appointments_api, docs_superpowers_plans_2026_08_09_cancel_hard_delete_dashboard_cancelled_tab, docs_superpowers_plans_2026_08_09_cancel_hard_delete_profile_cancel_delete, docs_superpowers_plans_2026_08_09_cancel_hard_delete_soft_delete_removal [EXTRACTED 1.00]
- **Operaciones destructivas del admin protegidas por validacion de referencias y ConfirmDialog** — docs_superpowers_plans_2026_08_09_dashboard_cancel_delete_confirmdialog, docs_superpowers_plans_2026_08_09_dashboard_cancel_delete_api_clients_id_delete, docs_superpowers_plans_2026_08_09_dashboard_cancel_delete_api_services_id_delete, docs_superpowers_plans_2026_08_09_dashboard_cancel_delete_cancel_guard_completed, docs_superpowers_plans_2026_08_09_dashboard_cancel_delete_reference_validation [EXTRACTED 1.00]
- **Flujo factura de inventario -> stock (crear, editar, borrar)** — docs_superpowers_plans_2026_08_09_purchases_inventory_financials_api_bills, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_api_bills_id, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_createinventoryin, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_reversebillmovements, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_bill_items, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_inventory_items, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_inventory_movements [EXTRACTED 1.00]
- **Ciclo de cuentas por pagar: factura, pago y estado recalculado** — docs_superpowers_plans_2026_08_09_purchases_inventory_financials_bills, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_supplier_payments, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_recomputebillstatus, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_api_supplier_payments, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_supplierpaymentdialog, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_accountspayablecontent, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_bank_accounts [EXTRACTED 1.00]
- **Patron de reporte mensual: rango de mes unico compartido por P&L y listado de facturas** — docs_superpowers_plans_2026_08_09_purchases_inventory_financials_monthrange, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_getpnl, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_pnlresult, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_api_financials_pnl, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_financialscontent, docs_superpowers_plans_2026_08_09_purchases_inventory_financials_expense_categories [EXTRACTED 1.00]
- **Flujo de capturas de pago: reportar (cliente) -> aprobar/rechazar (admin) -> baja del saldo** — docs_superpowers_plans_2026_08_11_improvements_reportpaymentdialog, docs_superpowers_plans_2026_08_11_improvements_payment_receipts_route, docs_superpowers_plans_2026_08_11_improvements_payment_receipts_id_route, docs_superpowers_plans_2026_08_11_improvements_receipt_approval_flow, docs_superpowers_plans_2026_08_11_improvements_balancescontent, docs_superpowers_plans_2026_08_11_improvements_payments_table, docs_superpowers_plans_2026_08_11_improvements_client_balance_usd [INFERRED 0.95]
- **Sistema de permisos por admin (columna JSON -> authz -> guardas de pagina y API -> editor)** — docs_superpowers_plans_2026_08_11_improvements_users_permissions_column, docs_superpowers_plans_2026_08_11_improvements_authz_getpermissions, docs_superpowers_plans_2026_08_11_improvements_authz_haspermission, docs_superpowers_plans_2026_08_11_improvements_authz_canadjustinventory, docs_superpowers_plans_2026_08_11_improvements_permission_keys, docs_superpowers_plans_2026_08_11_improvements_my_permissions_route, docs_superpowers_plans_2026_08_11_improvements_admin_layout_nav_filtering, docs_superpowers_plans_2026_08_11_improvements_adminuserscontent, docs_superpowers_plans_2026_08_11_improvements_admins_route_patch [INFERRED 0.95]
- **Inventario con codigo de producto como PK: migracion de datos, API y grid** — docs_superpowers_plans_2026_08_11_improvements_product_code_as_primary_key, docs_superpowers_plans_2026_08_11_improvements_uuid_to_product_code_migration, docs_superpowers_plans_2026_08_11_improvements_migration_0009, docs_superpowers_plans_2026_08_11_improvements_inventory_items_route, docs_superpowers_plans_2026_08_11_improvements_inventory_items_barcode_photo_url, docs_superpowers_plans_2026_08_11_improvements_inventorycontent, docs_superpowers_plans_2026_08_11_improvements_seed_finance_demo [INFERRED 0.85]
- **Sesion de curso = 1 appointment + N course_enrollments + N service_purchases (CXC por alumno)** — docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_course_sessions_route, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_course_enrollments, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_service_purchases_financial_status, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_services_is_group, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_event_transaction_decoupling, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_leader_fk_anchor [EXTRACTED 1.00]
- **Estado financiero recalculado automaticamente en cada punto que toca el dinero** — docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_recompute_financial_status, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_payments_route, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_payments_id_route, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_payment_receipts_id_route, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_course_sessions_enrollments_route, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_appointments_id_route, docs_superpowers_plans_2026_08_27_course_group_cxc_cash_pln_apply_paid_to_client [EXTRACTED 1.00]
- **Usage-per-appointment flow (pick polishes -> complete -> stock/kardex)** — docs_superpowers_plans_2026_08_27_usage_and_purchases_improvements_completeappointmentdialog, docs_superpowers_plans_2026_08_27_usage_and_purchases_improvements_usage_payload, docs_superpowers_plans_2026_08_27_usage_and_purchases_improvements_api_appointments_id_patch, docs_superpowers_plans_2026_08_27_usage_and_purchases_improvements_recordusage, docs_superpowers_plans_2026_08_27_usage_and_purchases_improvements_appointmentusage, docs_superpowers_plans_2026_08_27_usage_and_purchases_improvements_inventoryitems_exhaustion_fields [EXTRACTED 1.00]
- **avg_cost correction audited in the kardex (EditCostDialog -> PATCH -> applyCostAdjustment)** — docs_superpowers_plans_2026_08_28_three_features_editcostdialog, docs_superpowers_plans_2026_08_28_three_features_api_inventory_items_id_patch, docs_superpowers_plans_2026_08_28_three_features_canadjustinventory, docs_superpowers_plans_2026_08_28_three_features_applycostadjustment, docs_superpowers_plans_2026_08_28_three_features_cost_adjust_kind, docs_superpowers_plans_2026_08_28_three_features_inventorycontent [EXTRACTED 1.00]
- **Servicios ya realizados sin cita: dialog -> POST /api/purchases -> orphan snapshot -> CRM balance** — docs_superpowers_plans_2026_08_28_three_features_addservicedialog, docs_superpowers_plans_2026_08_28_three_features_api_purchases_post, docs_superpowers_plans_2026_08_28_three_features_service_purchases_optional_appointment, docs_superpowers_plans_2026_08_28_three_features_recomputefinancialstatus, docs_superpowers_plans_2026_08_28_three_features_applypaidtoclient, docs_superpowers_plans_2026_08_28_three_features_crm_balance_leftjoin_fix [EXTRACTED 1.00]
- **Privacy policy module end-to-end stack** — docs_superpowers_plans_2026_09_02_privacy_policy_legalsettings, docs_superpowers_plans_2026_09_02_privacy_policy_privacypolicyvalues, docs_superpowers_plans_2026_09_02_privacy_policy_privacypolicydefaults, docs_superpowers_plans_2026_09_02_privacy_policy_renderprivacypolicy, docs_superpowers_plans_2026_09_02_privacy_policy_publiclegalapiroute, docs_superpowers_plans_2026_09_02_privacy_policy_adminlegalapiroute, docs_superpowers_plans_2026_09_02_privacy_policy_politicaspage, docs_superpowers_plans_2026_09_02_privacy_policy_legalcontent, docs_superpowers_plans_2026_09_02_privacy_policy_legalpage [EXTRACTED 1.00]
- **Public read path for /politicas** — docs_superpowers_plans_2026_09_02_privacy_policy_politicaspage, docs_superpowers_plans_2026_09_02_privacy_policy_dbindex, docs_superpowers_plans_2026_09_02_privacy_policy_legalsettings, docs_superpowers_plans_2026_09_02_privacy_policy_privacypolicykey, docs_superpowers_plans_2026_09_02_privacy_policy_privacypolicydefaults, docs_superpowers_plans_2026_09_02_privacy_policy_renderprivacypolicy [EXTRACTED 1.00]
- **Admin write path for /dashboard/legal** — docs_superpowers_plans_2026_09_02_privacy_policy_adminlayout, docs_superpowers_plans_2026_09_02_privacy_policy_legalpage, docs_superpowers_plans_2026_09_02_privacy_policy_legalcontent, docs_superpowers_plans_2026_09_02_privacy_policy_adminlegalapiroute, docs_superpowers_plans_2026_09_02_privacy_policy_putvalidation, docs_superpowers_plans_2026_09_02_privacy_policy_haspermission, docs_superpowers_plans_2026_09_02_privacy_policy_legalsettings [EXTRACTED 1.00]
- **Audit write path (mutating endpoint → logActivity → activity_logs)** — docs_superpowers_plans_2026_09_23_activity_log_endpoint_instrumentation, docs_superpowers_plans_2026_09_23_activity_log_logactivity, docs_superpowers_plans_2026_09_23_activity_log_audit_module, docs_superpowers_plans_2026_09_23_activity_log_schema_activitylogs, docs_superpowers_plans_2026_09_23_activity_log_activity_logs_table [EXTRACTED 1.00]
- **Audit read path (permission-gated APIs + query helpers)** — docs_superpowers_plans_2026_09_23_activity_log_api_activity_logs_get, docs_superpowers_plans_2026_09_23_activity_log_api_activity_logs_actors_get, docs_superpowers_plans_2026_09_23_activity_log_listactivitylogs, docs_superpowers_plans_2026_09_23_activity_log_listactivityactors, docs_superpowers_plans_2026_09_23_activity_log_haspermission, docs_superpowers_plans_2026_09_23_activity_log_activitylog_permission [EXTRACTED 1.00]
- **Activity dashboard UI (page + content + nav + draft/applied filters + offset pagination)** — docs_superpowers_plans_2026_09_23_activity_log_activity_page, docs_superpowers_plans_2026_09_23_activity_log_activitylogcontent, docs_superpowers_plans_2026_09_23_activity_log_admin_layout_nav, docs_superpowers_plans_2026_09_23_activity_log_draft_applied_filters, docs_superpowers_plans_2026_09_23_activity_log_offset_pagination [EXTRACTED 1.00]
- **Photo lifecycle: reference upload -> final upload -> inspiration wall** — docs_superpowers_specs_2026_08_02_admin_roles_calendar_bugs_design_appointment_photos, docs_superpowers_specs_2026_08_07_gallery_crm_service_photos_design_photos_kind, docs_superpowers_specs_2026_08_07_gallery_crm_service_photos_design_complete_dialog, docs_superpowers_specs_2026_08_07_gallery_crm_service_photos_design_gallery_api, docs_superpowers_specs_2026_08_07_gallery_crm_service_photos_design_booking_models, docs_superpowers_specs_2026_08_07_gallery_crm_service_photos_design_gallery_grid_agendar [EXTRACTED 1.00]
- **Receivables flow: BCV rate cache -> payment -> live balance** — docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_bcv_lib, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_exchange_rates, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_payments, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_live_balance, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_balances_api, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_register_payment_dialog [EXTRACTED 1.00]
- **Single source of truth for appointment availability (slots, server validation, working hours, blockouts)** — docs_superpowers_specs_2026_07_27_nails_mvp_design_slots_pure_function, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_slots_lib, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_availability_lib, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_working_hours, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_blockouts_api, docs_superpowers_specs_2026_08_08_admin_appointments_receivables_design_walkin_appointment [INFERRED 0.90]
- **Modulo financiero: cuentas por pagar, inventario con kardex y P&L mensual en base devengo** — docs_superpowers_specs_2026_08_09_purchases_inventory_financials_design_cuentas_por_pagar_unica_tabla_bills, docs_superpowers_specs_2026_08_09_purchases_inventory_financials_design_bills, docs_superpowers_specs_2026_08_09_purchases_inventory_financials_design_inventory_items, docs_superpowers_specs_2026_08_09_purchases_inventory_financials_design_inventory_movements, docs_superpowers_specs_2026_08_09_purchases_inventory_financials_design_service_products, docs_superpowers_specs_2026_08_09_purchases_inventory_financials_design_get_pnl [EXTRACTED 1.00]
- **Trazabilidad de inventario: entradas por factura, salidas por uso en cita y ajustes de costo en el kardex** — docs_superpowers_specs_2026_08_09_purchases_inventory_financials_design_inventory_movements, docs_superpowers_specs_2026_08_09_purchases_inventory_financials_design_create_inventory_in, docs_superpowers_specs_2026_08_27_usage_and_purchases_improvements_design_appointment_usage, docs_superpowers_specs_2026_08_27_usage_and_purchases_improvements_design_record_usage, docs_superpowers_specs_2026_08_28_three_features_design_apply_cost_adjustment, docs_superpowers_specs_2026_08_28_three_features_design_inventory_movements_cost_adjust [INFERRED 0.75]
- **CXC que nace al agendar y se salda con pagos en cualquier momento, incluidos los no completados** — docs_superpowers_specs_2026_08_27_course_group_services_and_cxc_design_cxc_nace_al_agendar, docs_superpowers_specs_2026_08_27_course_group_services_and_cxc_design_service_purchases_financial_status, docs_superpowers_specs_2026_08_27_course_group_services_and_cxc_design_recompute_financial_status, docs_superpowers_specs_2026_08_27_course_group_services_and_cxc_design_post_api_payments, docs_superpowers_specs_2026_08_11_improvements_design_payment_receipts, docs_superpowers_specs_2026_08_28_three_features_design_servicio_ya_realizado_sin_cita [INFERRED 0.85]
- **Legal Settings Module: Table → Endpoints → Public Page → Admin Form** — docs_superpowers_specs_2026_09_02_privacy_policy_design_legalsettings, docs_superpowers_specs_2026_09_02_privacy_policy_design_public_privacy_api, docs_superpowers_specs_2026_09_02_privacy_policy_design_admin_privacy_api, docs_superpowers_specs_2026_09_02_privacy_policy_design_politicas_page, docs_superpowers_specs_2026_09_02_privacy_policy_design_legal_content_form, docs_superpowers_specs_2026_09_02_privacy_policy_design_render_privacy_policy [EXTRACTED 1.00]
- **Audit Instrumentation Pipeline: logActivity() → activity_logs → Query API → Activity Dashboard** — docs_superpowers_specs_2026_09_23_activity_log_design_mutation_coverage, docs_superpowers_specs_2026_09_23_activity_log_design_log_activity_helper, docs_superpowers_specs_2026_09_23_activity_log_design_activity_logs_table, docs_superpowers_specs_2026_09_23_activity_log_design_activity_logs_api, docs_superpowers_specs_2026_09_23_activity_log_design_activity_logs_actors_api, docs_superpowers_specs_2026_09_23_activity_log_design_activity_log_content, docs_superpowers_specs_2026_09_23_activity_log_design_activity_dashboard_page [EXTRACTED 1.00]
- **Permission-Gated Admin Module Pattern (page + API + nav item behind one key)** — docs_superpowers_specs_2026_09_23_activity_log_design_activitylog_permission, docs_superpowers_specs_2026_09_02_privacy_policy_design_settings_permission, docs_superpowers_specs_2026_09_23_activity_log_design_activity_dashboard_page, docs_superpowers_specs_2026_09_23_activity_log_design_activity_logs_api, docs_superpowers_specs_2026_09_02_privacy_policy_design_admin_privacy_api [INFERRED 0.75]

## Communities (148 total, 24 thin omitted)

### Community 0 - "Endpoints API del dashboard"
Cohesion: 0.08
Nodes (73): Modulo de cuentas por cobrar (CXC), src/app/(admin)/layout.tsx (NAV_ITEMS), Guarda isAdmin en todos los endpoints nuevos, PATCH /api/appointments/[id] (completar cita), POST /api/appointments con clientId de admin, GET /api/balances, DELETE /api/blockouts/[id], GET/POST /api/blockouts (+65 more)

### Community 1 - "Páginas admin y adaptador Drizzle"
Cohesion: 0.06
Nodes (39): auth/drizzle/adapter, next/auth/providers/credentials, next/navigation, AccountsPayablePage(), ActivityPage(), BalancesPage(), ClientsPage(), ExchangeRatesPage() (+31 more)

### Community 2 - "Permisos, navegación y cuentas por cobrar"
Cohesion: 0.07
Nodes (63): Filtrado de NAV_ITEMS en src/app/(admin)/layout.tsx, PATCH /api/admins (guarda isSuperAdmin), AdminUsersContent (editor de permisos por modulo), canAdjustInventory(session) en src/lib/authz.ts, getPermissions(session) en src/lib/authz.ts, hasPermission(session, perm) en src/lib/authz.ts, BalancesContent (pestana 'Pagos recibidos'), getTodayRate() en src/lib/bcv.ts (+55 more)

### Community 3 - "API de compras, inventario y financieros"
Cohesion: 0.07
Nodes (61): AccountsPayableContent (/dashboard/accounts-payable: porPagar | pagos | bancos), NAV_ITEMS de src/app/(admin)/layout.tsx (4 entradas nuevas del sidebar), GET/POST /api/bank-accounts (cuenta, tipo, moneda USD|VES), PATCH/DELETE /api/bank-accounts/[id] (bloqueado si tiene supplier_payments), GET/POST /api/bills (filtros status/supplierId/type/month; crea items y stock), GET/PATCH/DELETE /api/bills/[id] (items y pagos; revierte inventario al borrar), GET /api/exchange-rate (tasa del dia para los dialogos en Bs), GET/POST /api/expense-categories (?includeInactive=1) (+53 more)

### Community 4 - "Rutas de perfil y reserva"
Cohesion: 0.08
Nodes (27): bcryptjs, drizzle/orm, POST(), POST(), DELETE(), GET(), POST(), GET() (+19 more)

### Community 5 - "Migraciones base del esquema"
Cohesion: 0.07
Nodes (35): `account`, `appointments`, `blockouts`, `services`, `session`, `users`, `verificationToken`, `waitlist` (+27 more)

### Community 6 - "Uso de inventario por cita y agotado"
Cohesion: 0.06
Nodes (49): PATCH /api/appointments/[id] (complete flow), PATCH /api/inventory/items/[id], POST /api/inventory/items, applyManualMovement(itemId, kind, quantity, notes, createdBy), Table appointment_usage (appointment_id, inventory_item_id, quantity), Rationale: auto-generated product code (PRD-<n>), BillFormDialog, CompleteAppointmentDialog (used-products section) (+41 more)

### Community 7 - "Fotos de citas, galería y servicios"
Cohesion: 0.07
Nodes (45): GET /api/appointments/[id]/photos (solo kind='reference'), PATCH /api/appointments/[id] (completar con finalPhotos), GET/POST /api/clients (listado con ?q= y alta manual), PATCH /api/clients/[id] (name, phone, address, techNotes), GET /api/gallery (muro a nivel de foto, cursor + filtro), PATCH /api/profile (autoedición de phone/address), GET /api/services (devuelve photos por servicio), DELETE /api/services/[id]/photos/[photoId] (+37 more)

### Community 8 - "Diálogos de agenda y tasas"
Cohesion: 0.07
Nodes (28): AccountsPayableContent(), BankAccount, Bill, Payment, round2(), BlockoutDialog(), submit(), Props (+20 more)

### Community 9 - "Pruebas de authz y del visor"
Cohesion: 0.12
Nodes (28): IDENTITY, lockScroll(), PhotoLightbox(), PhotoLightboxState, Props, fileExtension(), isSameOriginUrl(), KNOWN_EXTENSIONS (+20 more)

### Community 10 - "Módulo de log de actividad"
Cohesion: 0.11
Nodes (36): User Activity Log Module (Audit Log), activity_logs table (auditoría), /dashboard/activity page (server component), activityLog permission key, ActivityLogContent (client UI), ActivityLogFilters, actor_name snapshot column, Admin layout NAV_ITEMS entry 'Actividad' (+28 more)

### Community 11 - "Wizard de reserva"
Cohesion: 0.09
Nodes (22): BookingWizard(), handleJoinWaitlist(), handleSlotSelect(), GalleryItem, MONTHS, Service, signInGoogle(), Slot (+14 more)

### Community 12 - "Esquema Drizzle de tablas"
Cohesion: 0.06
Nodes (34): drizzle/orm/sqlite/core, accounts, activityLogs, appointmentPhotos, appointments, appointmentUsage, bankAccounts, billItems (+26 more)

### Community 13 - "Módulo legal y política de privacidad"
Cohesion: 0.18
Nodes (34): GET/PUT /api/admin/legal/privacy (Admin Endpoint), brandSettings Key/Value Pattern (Schema Precedent), /dashboard/legal LegalContent Admin Form, legalSettings (legal_settings) Singleton Table, Missing-Row Defaults and Non-Crashing Banner, OCR Source: 20 PNGs in img-pp/ (img-pp-ocr/_all.txt), /politicas Public Privacy Policy Page, privacy-policy-page Reusable Skill (+26 more)

### Community 14 - "Portal del cliente"
Cohesion: 0.07
Nodes (21): react, ExchangeRatesContent(), RateRow, defaultMonth, FinancialsContent(), PnLBreakdownItem, PnLResult, Appointment (+13 more)

### Community 15 - "Muro de inspiración y producción"
Cohesion: 0.08
Nodes (22): next/image, BrandContent(), BrandPage(), EMPTY_FILTERS, Filters, GalleryContent(), GalleryPhoto, ProductionPhoto (+14 more)

### Community 16 - "Ajustes de costo de inventario"
Cohesion: 0.11
Nodes (24): InventoryPage(), DELETE(), GET(), PATCH(), RouteParams, GET(), POST(), GET() (+16 more)

### Community 17 - "Tasas BCV, cron y utils"
Cohesion: 0.12
Nodes (25): node/crypto, node/fs_promises, node/https, node/os, node/path, vitest/config, GET(), isValidSecret() (+17 more)

### Community 18 - "Handlers de rutas API y auditoría"
Cohesion: 0.11
Nodes (22): DELETE(), PATCH(), RouteParams, DELETE(), GET(), PATCH(), GET(), POST() (+14 more)

### Community 19 - "Configuración de TypeScript"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 20 - "Archivo de producción de fotos"
Cohesion: 0.10
Nodes (27): /api/gallery-photos (GET/POST/DELETE), GET /api/production-photos (archivo de produccion), AppointmentCard, BalancesContent, buildProductionCaption, DashboardContent, Paginacion por dia con dias completos, dayKeyFromTimestamp (src/lib/production-photos.ts) (+19 more)

### Community 21 - "Ajustes legales singleton"
Cohesion: 0.23
Nodes (27): Admin layout NAV_ITEMS (sidebar nav), GET + PUT /api/admin/legal/privacy (admin, settings-gated), db + schema singleton access (@/db/index), fmtDate (es-ES long date formatter), hasPermission(session, key) authorization guard, LegalContent (admin legal form, client component), Privacy Policy Legal Module, LegalPage (/dashboard/legal server wrapper) (+19 more)

### Community 22 - "Cursos grupales y CXC por alumno"
Cohesion: 0.13
Nodes (26): La agenda muestra la sesion de curso como bloque de grupo con numero de alumnos, Balances muestra la deuda desde el agendado con desglose por item y estado financiero, Al cancelar, el service_purchases del cliente pasa a financial_status void (historial, no CXC), Al completar un curso el admin cobra a los alumnos que quiera y deja el resto pendiente, Tabla course_enrollments (alumnos de una sesion de curso), Dialogo Agendar sesion de curso (multi-select de alumnos, precio por alumno), El curso es un tipo de servicio grupal, no un modulo aparte: evita duplicar facturacion (YAGNI en MVP), Curso = sesion grupal programada: una fecha y hora fija con varios alumnos juntos (+18 more)

### Community 23 - "Dependencias de desarrollo"
Cohesion: 0.08
Nodes (25): drizzle-kit, eslint, eslint-config-next, jsdom, devDependencies, drizzle-kit, eslint, eslint-config-next (+17 more)

### Community 24 - "RISC y utilidades de sistema"
Cohesion: 0.10
Nodes (21): fs, google/auth/library, EVENTS, alreadySeen(), invalidateUser(), lockUser(), oauthClient, POST() (+13 more)

### Community 25 - "Handlers de rutas API y auditoría"
Cohesion: 0.10
Nodes (19): fs/promises, path, GET(), GET(), firstName(), GET(), POST(), DELETE() (+11 more)

### Community 26 - "Pagos y estado financiero del cliente"
Cohesion: 0.15
Nodes (19): DELETE(), POST(), RouteParams, DELETE(), PATCH(), RouteParams, DELETE(), DELETE() (+11 more)

### Community 27 - "Visor de fotos y muro prellenado"
Cohesion: 0.12
Nodes (24): Accepted risk: vitest 2.1.9 critical advisory, BookingWizard component, src/lib/download-name.ts (slugified download name), /api/gallery-photos endpoints, Pre-filling the wall with gallery_photos, gallery_photos table, GalleryGrid component (public wall), Fix: Google sign-in from /book threw UnknownAction (+16 more)

### Community 28 - "CRM de clientes y servicios"
Cohesion: 0.10
Nodes (13): Client, ClientsContent(), EditingState, EMPTY_FORM, Service, ClientCRMPanel(), ClientData, PhotoGroup (+5 more)

### Community 29 - "Tablas de pagos y facturas"
Cohesion: 0.13
Nodes (22): AccountsPayableContent, /api/bills (POST/DELETE), /api/payment-receipts (GET/POST/PATCH/DELETE), applyPaidToClient, bank_accounts (tabla), bill_items (lineas de factura), bills (cuentas por pagar), expense_categories (tabla) (+14 more)

### Community 30 - "Script de rebuild de graphify"
Cohesion: 0.20
Nodes (21): Path, main(), graphify: reconstruccion incremental del grafo de conocimiento. Corre la parte…, Recupera o reetiqueta las comunidades que quedaron como 'Community N'., Ruta de extraction-spec.md del paquete graphify instalado., run(), spec_path(), step_ast() (+13 more)

### Community 31 - "UI de cuentas por cobrar"
Cohesion: 0.10
Nodes (13): BalanceClient, BalanceItem, BalancesContent(), Payment, Receipt, AddServiceDialog(), Client, nowDateTimeLocal() (+5 more)

### Community 32 - "Rutas admin y registro de uso"
Cohesion: 0.14
Nodes (16): DELETE(), GET(), POST(), GET(), DELETE(), PATCH(), GET(), GET() (+8 more)

### Community 33 - "Seed de datos financieros"
Cohesion: 0.09
Nodes (18): acrylicId, ADMIN_ID, bankUsd, bankVes, bill1, bill1Items, bill1Total, bill2 (+10 more)

### Community 34 - "Stack, autenticación y lista de espera"
Cohesion: 0.11
Nodes (21): Accepted risk: drizzle-kit 0.31.11 + esbuild 0.18.20, Multi-device Google auth via Host header, Email/password login (Credentials provider), Google Calendar push sync (client + admin), Maintenance rule: update AGENTS.md, CHANGELOG.md and README.md together, src/db/schema.ts (Drizzle schema), Waiting list for fully booked days, /api/waitlist endpoints (+13 more)

### Community 35 - "Cuentas por pagar y P&L"
Cohesion: 0.18
Nodes (21): Bancos: catalogo de cuentas para origen/destino de pagos, no conciliacion, Tabla bank_accounts (cuentas bancarias), BillFormDialog (alta y edicion de factura con lineas de inventario), Tabla bill_items (lineas de factura de inventario), Tabla bills (facturas de compra y gastos, type inventory o fixed), Cuentas por pagar = facturas de insumos + gastos fijos en una tabla unica bills, Spec Compras, Cuentas por Pagar, Inventario y Estados Financieros (2026-08-09), Tabla expense_categories (categorias de gasto) (+13 more)

### Community 36 - "Agenda del día y semana"
Cohesion: 0.14
Nodes (16): Appointment, Blockout, DashboardContent(), handleCancel(), refreshAll(), shiftWeek(), datesOfWeek(), fmtDate() (+8 more)

### Community 37 - "Seguridad de dependencias y BCV"
Cohesion: 0.11
Nodes (20): BCV exchange-rate backfill of missing dates, src/lib/bcv.ts (refreshTodayRate, backfillMissingRates), GET /api/exchange-rate/backfill, exchange_rates table, Google RISC (Cross-Account Protection) receiver, src/lib/image-upload.ts (magic-byte validation, 17 tests), next.config.ts (nosniff for /uploads, images.remotePatterns), Next.js 16.3.6 upgrade (unauthenticated RCE patches) (+12 more)

### Community 38 - "Validación de subidas por magic bytes"
Cohesion: 0.17
Nodes (11): POST(), ACCEPTED_IMAGE_EXTENSIONS, AcceptedImageExtension, ascii(), asciiBytes(), DetectImageResult, detectImageType(), isIsoBmff() (+3 more)

### Community 39 - "Dependencias de producción"
Cohesion: 0.11
Nodes (19): @auth/drizzle-adapter, bcryptjs, better-sqlite3, drizzle-orm, google-auth-library, next, next-auth, dependencies (+11 more)

### Community 40 - "Eliminación de clientes y servicios"
Cohesion: 0.15
Nodes (19): Proteccion de usuarios con role admin (403), DELETE /api/clients/[id], DELETE /api/services/[id], schema.appointments, Cancelar cita desde la agenda con confirmacion, ClientCRMPanel (eliminar cliente + prop onDeleted), ClientsContent (eliminar cliente desde la lista), ConfirmDialog (+11 more)

### Community 41 - "Sesiones de curso"
Cohesion: 0.15
Nodes (19): AppointmentCard (badge Curso - N alumnos), GET /api/appointments (isGroup + studentCount), schema.courseEnrollments (alumnos por sesion, unique appointment+client), /api/course-sessions/[id]/enrollments (POST/DELETE alumno pre-completar), /api/course-sessions (POST crear sesion, GET listar con saldo por alumno), CourseSessionDialog, DashboardContent (bloque grupo + boton nueva sesion de curso), Migracion drizzle/00NN_*.sql (db:generate + db:migrate) (+11 more)

### Community 42 - "Scripts npm"
Cohesion: 0.11
Nodes (18): scripts, build, db:backfill:rates, db:generate, db:migrate, db:reset, db:seed, db:seed:client (+10 more)

### Community 43 - "Header y layouts públicos"
Cohesion: 0.15
Nodes (8): next/link, AdminLayout(), AdminShell(), NAV_ITEMS, Header(), HeaderProps, NavItem, SignOutButton()

### Community 44 - "Pruebas jsdom del visor"
Cohesion: 0.12
Nodes (12): react/dom/client, DEFAULT_VIEWPORT, FakeResizeObserver, lightboxImage(), loadImage(), NATURAL, ObserverRecord, observers (+4 more)

### Community 45 - "Servicio realizado y citas pendientes"
Cohesion: 0.22
Nodes (17): AddServiceDialog (Servicio realizado), DELETE /api/appointments/[id], GET /api/appointments?pendingOnly=1, /api/appointments/[id]/review, POST/GET /api/course-sessions, /api/course-sessions/[id]/enrollments, /api/purchases (POST/DELETE), appointments (tabla) (+9 more)

### Community 46 - "Permisos por administrador"
Cohesion: 0.14
Nodes (17): AdminShell, GET /api/activity-logs y /actors, PATCH /api/admins, GET /api/my-permissions, getPermissions(session), hasAnyPermission(session, keys), hasPermission(session, key), Expansion del permiso legacy settings (+9 more)

### Community 47 - "MVP de reserva y muro"
Cohesion: 0.16
Nodes (17): 3-Step Booking Wizard (service, date/time, photo+confirm), Inspiration Wall: Cursor-Paginated Grid with Filter Pills, appointment_photos Table (1:N Reference Photos), handleConfirm Hardening in BookingWizard (try/catch, finally reset), Dashboard Day/Week Calendar View with Reprogramar, Booking Step 3 Inspiration Model Picker, CompleteAppointmentDialog (Multi-Photo Final Upload), All Final Photos Auto-Published to the Wall (+9 more)

### Community 48 - "UI de cuentas por pagar"
Cohesion: 0.12
Nodes (17): AccountsPayableContent.tsx (Por pagar, Pagos realizados, Bancos), NAV_ITEMS del layout admin (entradas Compras, Cuentas por pagar, Inventario, Financieros), FinancialsContent.tsx (P&L mensual con desglose por servicio y categoria), GET /api/financials/pnl?month=YYYY-MM, POST /api/supplier-payments (abono a factura y recálculo de estado), recomputeBillStatus() en src/lib/bills.ts (pending, partial, paid desde suma de pagos), SupplierPaymentDialog (registro de pago a proveedor en USD o Bs), GET /api/financials/pnl que devuelve recaudacion y produccion (+9 more)

### Community 49 - "Capturas de pago y códigos"
Cohesion: 0.18
Nodes (17): BalancesContent.tsx con pestana Pagos recibidos (aprobar o rechazar capturas), Capturas (foto) como evidencia: obligatorias en pagos a proveedores y recibos del cliente, El codigo de producto pasa a ser la PK de inventory_items y es distinto del codigo de barras, DELETE /api/payment-receipts/[id] (solo pending; borra el payment ligado), Spec Mejoras en compras, inventario, pagos recibidos y permisos (2026-08-11), Flujo: el admin aprueba o rechaza la captura y se inserta el pago en payments, Flujo: el cliente reporta su pago en Bs con captura desde su perfil, GET /api/payment-receipts (admin ve todas, cliente solo las suyas) (+9 more)

### Community 50 - "Categorías de esmalte y agotado"
Cohesion: 0.20
Nodes (17): El agotado es automatico (usesConsumed mayor o igual a maxUses) y manual (boton Marcar agotado), Tabla appointment_usage (uso de productos por cita, unico por cita e item), Categoria y subcategoria aplican solo a productos tipo esmalte, Si el codigo de producto viene vacio se genera ascendentemente con prefijo PRD, CompleteAppointmentDialog con seccion Productos usados (esmaltes) por categoria y subcategoria, Spec Codigo automatico, edicion de facturas, usos por cita y agotado (2026-08-27), Bug: PurchasesContent.openEdit no llamaba setShowForm y el dialogo de edicion nunca abria, InventoryContent.tsx con categoria, subcategoria, max usos, badge Agotado y Marcar agotado (+9 more)

### Community 51 - "Cancelación hard-delete y reseñas"
Cohesion: 0.14
Nodes (16): Cancelling hard-deletes and archives a snapshot, Real product usage per appointment, appointment_usage table, /api/appointments endpoints (incl. pendingOnly=1), cancelled_appointments archive table, CompleteAppointmentDialog component, /api/inventory/items endpoints, inventory_items table (+8 more)

### Community 52 - "Estado financiero de compras"
Cohesion: 0.20
Nodes (16): applyPaidToClient(userId) - totalRevenue = recaudado, /api/appointments/[id] (completar y cancelar), Backfill de completion_date / financial_status en datos heredados, CompleteAppointmentDialog (estado financiero y opcion dejar pendiente), service_purchases.completion_date (doble fecha vs payments.paid_at), computeFinancialStatus(totalPaid, price), src/lib/financial-status.ts, getOpenPurchases(userId) (+8 more)

### Community 53 - "Edición de costo y saldo del CRM"
Cohesion: 0.18
Nodes (16): PATCH /api/inventory/items/[id] (category, subcategory, maxUses), AddServiceDialog.tsx (cliente, servicio, fecha, precio editable y notas), applyCostAdjustment() en src/lib/inventory.ts (actualiza avg_cost y deja fila cost_adjust en el kardex), applyPaidToClient(userId) en src/lib/financial-status.ts (recalcula lo recaudado del cliente), Spec Tres features pequenos: reference opcional, servicio ya realizado y edicion de avg_cost (2026-08-28), EditCostDialog.tsx (nuevo costo y motivo obligatorio, minimo 3 caracteres), Feature 2 y el fix del INNER JOIN van en el mismo commit o el CRM queda roto en silencio, Fix critico: el INNER JOIN appointments dejaba fuera del saldo las compras sin cita (+8 more)

### Community 54 - "Página de política de privacidad"
Cohesion: 0.23
Nodes (7): dynamic, PoliticasPage(), PRIVACY_POLICY_DEFAULTS, fmtDate(), renderPrivacyPolicy(), PRIVACY_POLICY_KEY, PrivacyPolicyValues

### Community 55 - "Landing pública y reseñas"
Cohesion: 0.22
Nodes (10): dynamic, HomePage(), ReviewPage(), ReviewForm(), ReviewFormProps, DEFAULTS, getBrandSettings(), getSalonLogo() (+2 more)

### Community 56 - "Pasaporte de uñas del CRM"
Cohesion: 0.16
Nodes (15): /api/appointments/[id]/photos, GET /api/gallery, appointment_photos (tabla), ClientCRMPanel, client.passportGroups (pasaporte de unas), client.photoGroups (referencias por cita), Propiedad de datos frente a marketplaces, Evitar fan-out usando services.name (+7 more)

### Community 57 - "UI de compras"
Cohesion: 0.15
Nodes (10): Bill, CategoriesSection(), create(), Category, fmtDate(), PurchasesContent(), statusPill, Supplier (+2 more)

### Community 58 - "Utilidades del archivo de producción"
Cohesion: 0.36
Nodes (12): GET(), buildProductionCaption(), dayKeyFormatter(), dayKeyFormatters, dayKeyFromTimestamp(), dayLabelFromKey(), escapeLikePattern(), foldSearchText() (+4 more)

### Community 59 - "Disponibilidad y slots"
Cohesion: 0.23
Nodes (11): GET(), GET(), PUT(), generateSlots(), SlotInput, SlotTime, DEFAULT_WORKING_HOURS, getWorkingHoursAll() (+3 more)

### Community 60 - "Tablas de Auth.js y RISC"
Cohesion: 0.16
Nodes (14): activity_logs (auditoria), /api/clients (GET/POST/PATCH/DELETE), POST /api/risc/events, /api/waitlist (GET/POST/PATCH/DELETE), account, session, verificationToken (tablas Auth.js), BookingWizard, CourseSessionDialog, Docs actualizadas en el mismo commit (+6 more)

### Community 61 - "Layout admin y filtrado de permisos"
Cohesion: 0.20
Nodes (14): src/app/(admin)/layout.tsx Server Component, AdminShell component (permission-filtered sidebar), src/lib/authz.ts (hasPermission, hasAnyPermission), Per-admin permission system, src/lib/permissions.ts (PERMISSION_KEYS, parseStoredPermissions), Fail-closed reading of stored admin permissions, Dual P&L: collection vs production, Fix: hydration error in the dashboard sidebar (+6 more)

### Community 62 - "Handlers de rutas API y auditoría"
Cohesion: 0.16
Nodes (9): next/server, GET(), nextAutoCode(), POST(), GET(), POST(), withPhotos(), GET() (+1 more)

### Community 63 - "Seed de datos demo"
Cohesion: 0.14
Nodes (12): acrylicId, adminId, classicId, clientId, existingAdmin, existingAppts, existingBlockouts, existingClient (+4 more)

### Community 64 - "Endpoints de inventario y recetas"
Cohesion: 0.24
Nodes (13): POST /api/inventory/items, appointment_usage (uso por cita), BillFormDialog, CompleteAppointmentDialog, EditCostDialog, InventoryContent, inventory_items (inventario), inventory_movements (kardex) (+5 more)

### Community 65 - "UI de inventario"
Cohesion: 0.18
Nodes (8): InventoryItem, Movement, Service, UseLine, EditCostDialog(), Props, MovementDialog(), Props

### Community 66 - "UI de inventario"
Cohesion: 0.21
Nodes (9): addUseLine(), BillFormDialog(), addItem(), submit(), BillPayload, fmtDateInput(), ItemLine, Props (+1 more)

### Community 67 - "Sincronización con Google Calendar"
Cohesion: 0.32
Nodes (12): syncAppointmentToGoogleCalendars(), createAppointmentAdminEvent(), createAppointmentClientEvent(), createEventOnPrimaryCalendar(), deleteAppointmentEvent(), deleteEventOnPrimaryCalendar(), fetchFreshGoogleToken(), getAdminUserId() (+4 more)

### Community 68 - "Condiciones de servicio"
Cohesion: 0.26
Nodes (6): CondicionesPage(), dynamic, fmtDate(), renderTermsOfService(), TERMS_OF_SERVICE_KEY, TermsOfServiceValues

### Community 69 - "Búsqueda sin acentos y archivo"
Cohesion: 0.21
Nodes (12): Accounts Receivable (/dashboard/balances), Client-side search in Accounts Receivable, fold() SQLite function (accent-insensitive SQL search), GalleryPublishControl component, Client-reported payment receipts with capture, /api/payment-receipts endpoints, payment_receipts table, Production photo archive tab (per day) (+4 more)

### Community 70 - "Compras sin cita y cursos"
Cohesion: 0.23
Nodes (12): Service already performed without appointment, course_enrollments table, Group course sessions with per-student enrollments, /api/course-sessions endpoints, Receivables are born at booking time, Delete purchases created without appointment, service_purchases.financial_status lifecycle, src/lib/financial-status.ts (recomputeFinancialStatus) (+4 more)

### Community 71 - "Roles y promoción de admins"
Cohesion: 0.27
Nodes (12): ADMIN_EMAIL Sign-in Promotion to Admin, /dashboard/admin-users Management Page, /api/admins Superadmin-Only Route (GET/POST/DELETE), lib/authz.ts Helpers (isAdmin, isSuperAdmin, getSessionRole), Role-Based Admin Authorization Replaces ADMIN_EMAIL Checks, Doc Maintenance Rule (AGENTS.md + CHANGELOG.md + README.md), Middleware Reduced to a Login Gate, Multi-Admin System with Roles (+4 more)

### Community 72 - "Movimientos de stock y recetas"
Cohesion: 0.21
Nodes (12): applyManualMovement() en src/lib/inventory.ts (salida y ajuste manual de stock), estUsos = stock / suma de quantity_per_service (estimacion de duracion de producto), GET /api/inventory/items (stock, avgCost, stockValue, estUsos), InventoryContent.tsx (Existencias, Movimientos, Uso por servicio), Tabla inventory_items (catalogo de insumos con stock y avg_cost), MovementDialog (salida o ajuste de stock con motivo obligatorio), POST /api/inventory/items/[id]/movements (salida o ajuste de stock), PUT /api/service-products (reemplaza el mapeo de productos de un servicio) (+4 more)

### Community 73 - "Layout raíz y sesión"
Cohesion: 0.18
Nodes (8): nextConfig, next, next/auth/react, next/font/google, geistMono, geistSans, metadata, SessionWrapper()

### Community 74 - "Configuración de NextAuth"
Cohesion: 0.18
Nodes (9): next/auth, next/auth/providers/facebook, next/auth/providers/google, { auth }, config, @auth/core/jwt, JWT, next-auth (+1 more)

### Community 75 - "Enlace de cuenta Google"
Cohesion: 0.23
Nodes (9): LinkableDb, linkGoogleAccount(), LinkGoogleInput, LinkGoogleResult, createTestDb(), seedUser(), TestDb, UserRow (+1 more)

### Community 76 - "Endpoints de tasa BCV"
Cohesion: 0.20
Nodes (11): GET/POST/DELETE /api/exchange-rate, GET /api/exchange-rate/backfill, GET /api/exchange-rate/current, GET /api/exchange-rate/refresh, backfillMissingRates, Precios y pagos en USD y VES, exchange_rates (tasa BCV del dia), getTodayRate (+3 more)

### Community 77 - "Fotos de cita y pasaporte"
Cohesion: 0.35
Nodes (11): appointment_photos table (kind reference|final), Client CRM (/dashboard/clients), Editable client email in the CRM, ClientCRMPanel component, GET/PATCH/DELETE /api/clients/[id], Per-appointment photoGroups in the CRM panel, Nail passport in the CRM client panel, All final photos in the client portal (+3 more)

### Community 78 - "Disponibilidad, slots y zona horaria"
Cohesion: 0.25
Nodes (11): src/lib/availability.ts (getOverlappingAppointments/Blockouts), Fix: BookingWizard dropped the slot minutes, Centralized Caracas timezone helpers, Fix: half-open [start, end) overlap semantics, ReschedulePicker component, 15-minute slot granularity, src/lib/slots.ts (generateSlots), src/lib/time.ts (SALON_TZ, tsToLocalDateStr) (+3 more)

### Community 79 - "Cancelación y archivo"
Cohesion: 0.24
Nodes (11): deleteEventOnPrimaryCalendar, Google Calendar Event Cleanup Before Hard Delete, GET /api/appointments/cancelled Endpoint, cancelled_appointments Indices (client_id, cancelled_at), cancelled_appointments Audit Table, Completed Appointments Cannot Be Cancelled (400), Dashboard 'Canceladas' Tab and History Table, DELETE /api/appointments/[id] Handler (+3 more)

### Community 80 - "Sidebar, OAuth y WhatsApp"
Cohesion: 0.20
Nodes (11): Dashboard Sidebar with Agenda + CRM + complete/cancel actions, Google Calendar Push on Booking Confirm, Google OAuth via NextAuth v5 + ADMIN_EMAIL, WhatsApp Deep Links via wa.me, Admin Roles, Google Calendar & Bug Fixes - Design Document, Root Cause: Auth.js v5 env var mismatch (AUTH_GOOGLE_ID), Maintenance Rule (AGENTS.md + CHANGELOG + README in same commit), /profile Shows Pending + Confirmed Appointments (+3 more)

### Community 81 - "Escritura best-effort en Calendar"
Cohesion: 0.25
Nodes (11): Best-Effort Calendar Writes (booking never blocked by Google), calendar.ts Google Calendar Integration (create/update/delete per user), googleEventIdClient + googleEventIdAdmin (Mirror Events), OAuth Refresh Token Flow on account Table, Appointment Rescheduling (PATCH startTime), DELETE /api/appointments/[id] (Archive + Hard Delete), PATCH Rejects status='cancelled' (400), ProfileContent.handleCancel Switched to DELETE (+3 more)

### Community 82 - "CRM y tarjetas de servicio"
Cohesion: 0.24
Nodes (11): ClientCRMPanel with Photo Carousel and Editable Contact, /api/clients CRUD (List, Create, Patch) for Admin, ClientsContent (/dashboard/clients), PhotoCarousel Component, ServiceCard Carousel of Service Photos (Home), Balance/Payments Section in ClientCRMPanel, RegisterPaymentDialog ($ or Bs with BCV rate), DashboardContent.handleCancel Switched to DELETE (+3 more)

### Community 83 - "Editor de permisos de admins"
Cohesion: 0.29
Nodes (8): vitest, Admin, CONFIGURATION_PERMISSION_KEYS, expandLegacyPermissions(), parseStoredPermissions(), PERMISSION_KEYS, PERMISSION_LABELS, PermissionKey

### Community 84 - "Formulario de login"
Cohesion: 0.22
Nodes (4): LoginForm(), GoogleSignInButton(), GoogleSignInButtonProps, Variant

### Community 85 - "Plan MVP de 6 fases"
Cohesion: 0.20
Nodes (11): Fase 1: Base de Datos y Seed, Fase 2: Autenticacion (NextAuth v5 + DrizzleAdapter), Fase 4: Wizard de Reserva (3 pasos), Fase 6: Portal de Cliente (/profile), Nails MVP 6-Phase Plan, NextAuth v5 Environment Variable Names, Post-MVP Out-of-Scope Improvements, /review/[id] Public Post-Appointment Review Form (+3 more)

### Community 86 - "Seguridad de subidas"
Cohesion: 0.20
Nodes (10): Riesgos de dependencias aceptados a proposito, POST /api/upload, Exclusion deliberada de AVIF y SVG, Pineado exacto de next y eslint-config-next, detectImageType, Validacion de subidas por magic bytes, MAX_UPLOAD_BYTES (25 MB), next.config.ts (cabecera nosniff en /uploads) (+2 more)

### Community 87 - "CXC desde el agendado"
Cohesion: 0.29
Nodes (10): GET /api/balances (deuda + items), BalancesContent (desglose por item + filtro por estado financiero), CXC desde el agendado (la deuda nace al reservar), Desacople Evento (appointments) vs Transaccion Economica (service_purchases), Plan: Cursos grupales + CXC desde el agendado + P&L base de caja, profile/page.tsx (statementItems y balanceUsd no-void), ProfileContent (Mi estado de cuenta), service_purchases.financial_status (pending|partial|paid|void) (+2 more)

### Community 88 - "Permisos granulares por módulo"
Cohesion: 0.27
Nodes (10): AdminUsersContent.tsx (editor de permisos con checkboxes por modulo), canAdjustInventory(session) (permiso extra para ajustes de stock), getPermissions(session) en src/lib/authz.ts, hasPermission(session, perm) en src/lib/authz.ts, La navegacion del dashboard se filtra en el servidor segun los permisos del admin, PATCH /api/admins (guarda users.permissions del admin seleccionado), Los permisos NO van en el token JWT: hasPermission consulta la DB por request, users.permissions es un JSON array; null o vacio equivale a acceso total para no bloquear admins existentes (+2 more)

### Community 89 - "Pruebas de auditoría y conexión"
Cohesion: 0.20
Nodes (6): better/sqlite3, drizzle/orm/better/sqlite3, db, sql, statements, TestDb

### Community 90 - "Agenda del día y semana"
Cohesion: 0.22
Nodes (5): CompletedAppointmentDialog(), Props, FinalPhoto, GalleryPublishControl(), Props

### Community 91 - "Diseño MVP de 5 tablas"
Cohesion: 0.28
Nodes (9): Nails MVP - Design Document, Core 5-Table Schema (users, services, appointments, waitlist, blockouts), Folder Structure (route groups public/client/admin), Configurable Salon Name (NEXT_PUBLIC_SALON_NAME), MVP Tech Stack (Next.js 15, Drizzle SQLite, NextAuth v5), service_photos Table (Photos per Service), ServicesContent with Per-Service Photo Manager, DELETE /api/services/[id] (In-Use Guard) (+1 more)

### Community 92 - "Overrides de dependencias"
Cohesion: 0.22
Nodes (8): name, overrides, brace-expansion@<1.1.18, brace-expansion@>=5.0.0 <5.0.9, js-yaml, nanoid, private, version

### Community 93 - "Página de actividad y guardas"
Cohesion: 0.42
Nodes (7): Page(), DELETE(), GET(), PATCH(), POST(), isSuperAdmin(), isPermissionKey()

### Community 96 - "MVP de panel y permisos"
Cohesion: 0.22
Nodes (9): Cancelar cita como hard delete con archivo en cancelled_appointments, ClientCRMPanel (tech_notes, stats, WhatsApp), Fase 3: Landing Publica y Muro de Inspiracion, Fase 5: Dashboard Admin (agenda, CRM, completar/cancelar/reprogramar), gallery Permission Key, Admin Pre-seeding of the Gallery Wall (gallery_photos), paymentApproval Permission for Client Payment Receipts, Sistema de Permisos (next stage) (+1 more)

### Community 97 - "Estrategia de verificación"
Cohesion: 0.25
Nodes (8): Verification Strategy Without a Test Runner, Removal of POST /api/appointments/[id]/cancel Route, Doc Maintenance Rule Applied to the Cancellation Change, Cancellation as Hard Delete with Archived Snapshot, PATCH Guard Rejecting status='cancelled', Verification Strategy Without a Test Runner, Soft Delete (status='cancelled') Removal, Pending Per-Module Authorization Tests (no test framework installed)

### Community 98 - "Slots, blockouts y horario"
Cohesion: 0.32
Nodes (8): slots.ts Pure Availability Function, availability.ts isSlotAvailable (Single Source of Truth), BlockoutDialog, /api/blockouts CRUD (No Available Time Blocks), NewAppointmentDialog (Walk-in Booking), slots.ts generateSlots + getWorkingHoursForDate, Admin-Created Appointments for Walk-ins (clientId field), working_hours Table (Per Weekday Open/Close)

### Community 99 - "API de cuentas por cobrar"
Cohesion: 0.39
Nodes (8): GET /api/balances (Clients with balanceUsd > 0), BalancesContent (/dashboard/balances), Payment Section inside CompleteAppointmentDialog, Live Balance Rule (no separate accounting ledger), payments Table (Accounts Receivable Payments), /api/payments CRUD (Admin), service_purchases.service_price as Balance Basis, Orphan Payments Allowed (appointment_id -> NULL)

### Community 100 - "UI de actividad y condiciones"
Cohesion: 0.29
Nodes (7): ACTION_LABELS, ACTION_STYLES, ActivityItem, ActivityLogContent(), ENTITY_LABELS, formatDate(), FragmentRow()

### Community 102 - "Helpers de Calendar por cita"
Cohesion: 0.43
Nodes (7): Appointment-Specific Calendar Helpers (client + admin events), Appointment Routes Calendar Sync Wiring, createEventOnPrimaryCalendar, getValidAccessToken Refresh Flow, lib/calendar.ts Google Calendar v3 Client, appointments.google_event_id_client / google_event_id_admin, updateEventOnPrimaryCalendar

### Community 103 - "Esquema del P&L"
Cohesion: 0.43
Nodes (7): schema.bills + expenseCategories (gastos), GET /api/financials/pnl, FinancialsContent (paneles Recaudacion y Produccion), getPnL(month) (src/lib/financials.ts), schema.payments (paid_at, amountUsd), P&L Produccion (devengado, por completion_date), P&L Recaudacion (base de caja, por payments.paid_at)

### Community 104 - "Editor de horario"
Cohesion: 0.29
Nodes (4): Day, DAY_LABELS, SettingsContent(), TIME_OPTIONS

### Community 105 - "Reprogramar citas"
Cohesion: 0.40
Nodes (6): AppointmentCard onReschedule Prop, appointments Indices (client_id, start_time), Dashboard Day/Week Calendar View (DashboardContent), Client Profile Upcoming Appointments Section, ReschedulePicker Modal (ReschedulePicker.tsx), America/Caracas Timezone and es-ES UI Constraint

### Community 106 - "Formulario legal del admin"
Cohesion: 0.33
Nodes (3): EMPTY, LegalContent(), Values

### Community 107 - "UI de actividad y condiciones"
Cohesion: 0.33
Nodes (3): EMPTY, TermsContent(), Values

### Community 108 - "API de ajustes legales"
Cohesion: 0.40
Nodes (4): GET(), optStr(), PUT(), PutBody

### Community 109 - "API de condiciones de servicio"
Cohesion: 0.40
Nodes (4): GET(), optStr(), PUT(), PutBody

### Community 110 - "API de ajustes de marca"
Cohesion: 0.47
Nodes (4): DEFAULTS, GET(), getAll(), PUT()

### Community 111 - "Diálogos de blockout"
Cohesion: 0.40
Nodes (5): BlockoutDialog, blockouts (tabla), NewAppointmentDialog, SettingsContent, working_hours (tabla)

### Community 112 - "Feature de audit log"
Cohesion: 0.50
Nodes (5): User activity log (audit trail), GET /api/activity-logs (+ /actors), activity_logs table, src/lib/audit.ts (logActivity), Feature: activity log with filters and pagination

### Community 113 - "Fotos de cita 1:N"
Cohesion: 0.50
Nodes (5): appointment_photos 1:N Table, POST /api/appointments Multi-Photo Create, BookingWizard Multi-Photo Upload and Submit Hardening, Cascade of service_purchases and appointment_photos on Delete, Cancellation Snapshot from service_purchases and appointment_photos

### Community 114 - "Guardas de Patch de cita"
Cohesion: 0.40
Nodes (5): PATCH /api/appointments/[id], Guarda: no cancelar citas completed/cancelled (400), Smoke test manual del dev server (Task 9), Verificacion por typecheck + lint + smoke manual (repo sin tests), Verificacion manual final (dev server) + build

### Community 115 - "API de administradores"
Cohesion: 0.70
Nodes (5): /api/admins Routes (GET, POST, DELETE) - Superadmin Only, authz.ts Helpers (getSessionUserRole, isAdmin, isSuperAdmin), Middleware vs. Server-Component Authorization Decision, users.role Column (client | admin), Movement Count Guard (appointments, payments, waitlist)

### Community 116 - "Kardex y costo promedio"
Cohesion: 0.50
Nodes (5): createInventoryIn() en src/lib/inventory.ts (entrada con recálculo de costo promedio), DELETE /api/bills/[id] (revierte el stock de la factura si no tiene pagos), Inventario nivel 2: kardex + costo promedio ponderado, Tabla inventory_movements (kardex: in, out, adjust), reverseBillMovements() en src/lib/inventory.ts (revierte entradas in de una factura)

### Community 117 - "Configuración de ESLint"
Cohesion: 0.40
Nodes (4): eslintConfig, eslint/config, eslint/config/next/core/web/vitals, eslint/config/next/typescript

### Community 119 - "UI de inventario"
Cohesion: 0.60
Nodes (3): InventorySearchItem, matchesInventoryItem(), normalizeSearchText()

### Community 120 - "Seed base de datos"
Cohesion: 0.50
Nodes (3): categoryNames, existingCategories, services

### Community 121 - "Scraper de la tasa BCV"
Cohesion: 1.00
Nodes (3): bcv.ts fetchBcvRate (HTML scrape of bcv.org.ve), exchange_rates Table (Daily BCV Rate Cache), getTodayRate (Cache-or-Scrape)

### Community 122 - "Scripts de seed y comandos"
Cohesion: 0.67
Nodes (3): Seed scripts (db:seed:client, db:seed:finance, db:seed:privacy), Useful npm commands (db:generate, db:migrate, lint, tsc), Demo data (clienta@email.com, ADMIN_EMAIL superadmin)

## Ambiguous Edges - Review These
- `dayKeyFromTimestamp (src/lib/production-photos.ts)` → `src/lib/zoom.ts (matematica de zoom y pan)`  [AMBIGUOUS]
  agents.md · relation: semantically_similar_to
- `getTodayRate()` → `GET /api/exchange-rate (tasa del dia)`  [AMBIGUOUS]
  docs/superpowers/plans/2026-08-08-admin-appointments-receivables.md · relation: conceptually_related_to
- `getTodayRate()` → `GET/POST /api/payments`  [AMBIGUOUS]
  docs/superpowers/plans/2026-08-08-admin-appointments-receivables.md · relation: conceptually_related_to
- `hasPermission(session, perm) en src/lib/authz.ts` → `GET/POST /api/payment-receipts`  [AMBIGUOUS]
  docs/superpowers/plans/2026-08-11-improvements.md · relation: calls
- `payment_receipts (tabla de capturas de pago de clientes)` → `src/db/seed-client-demo.ts (captura pendiente opcional)`  [AMBIGUOUS]
  docs/superpowers/plans/2026-08-11-improvements.md · relation: shares_data_with
- `canAdjustInventory(session) (permiso extra para ajustes de stock)` → `PATCH /api/inventory/items/[id] extendido con avgCost y costNotes (gate canAdjustInventory)`  [AMBIGUOUS]
  docs/superpowers/specs/2026-08-28-three-features-design.md · relation: references
- `legalSettings (legal_settings) Singleton Table` → `AuditEntity Union Type (23 Module Names)`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-23-activity-log-design.md · relation: conceptually_related_to

## Knowledge Gaps
- **515 isolated node(s):** ``blockouts``, ``verificationToken``, ``exchange_rates``, ``working_hours``, ``_inv_map`` (+510 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `dayKeyFromTimestamp (src/lib/production-photos.ts)` and `src/lib/zoom.ts (matematica de zoom y pan)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `getTodayRate()` and `GET /api/exchange-rate (tasa del dia)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `getTodayRate()` and `GET/POST /api/payments`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `hasPermission(session, perm) en src/lib/authz.ts` and `GET/POST /api/payment-receipts`?**
  _Edge tagged AMBIGUOUS (relation: calls) - confidence is low._
- **What is the exact relationship between `payment_receipts (tabla de capturas de pago de clientes)` and `src/db/seed-client-demo.ts (captura pendiente opcional)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `canAdjustInventory(session) (permiso extra para ajustes de stock)` and `PATCH /api/inventory/items/[id] extendido con avgCost y costNotes (gate canAdjustInventory)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `legalSettings (legal_settings) Singleton Table` and `AuditEntity Union Type (23 Module Names)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._