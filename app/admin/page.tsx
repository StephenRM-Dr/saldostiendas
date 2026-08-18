import AdminExportForm from './AdminExportForm';

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-xl font-semibold">Admin — Exportar Excel</h1>
      <AdminExportForm />
    </main>
  );
}
