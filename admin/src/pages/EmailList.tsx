import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { formatWhen } from '../dates';

type SignupRow = {
  id: string;
  email: string;
  created_at: string;
};

export default function EmailList() {
  const [rows, setRows] = useState<SignupRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase.rpc('admin_list_website_launch_signups');
    setLoading(false);
    if (loadError) return setError(loadError.message);
    setRows((data ?? []) as SignupRow[]);
    setError(null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h2>Website email list</h2>
      <p className="muted">
        People who asked to be notified when the app launches from the marketing site download modal.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <p className="muted" style={{ marginBottom: 12 }}>
        {loading ? 'Loading…' : `${rows.length} signup${rows.length === 1 ? '' : 's'}`}
      </p>
      <div className="table-wrap">
        <table className="sheet">
          <thead>
            <tr>
              <th>Email</th>
              <th>Signed up</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={2} className="muted">No signups yet.</td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>{formatWhen(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
