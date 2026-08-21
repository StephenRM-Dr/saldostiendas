import AdminExportForm from './AdminExportForm';
import AdminImportForm from './AdminImportForm';

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Admin — Exportar Excel</h1>
        <AdminExportForm />
      </div>
      <AdminImportForm />
    </main>
  );
}
