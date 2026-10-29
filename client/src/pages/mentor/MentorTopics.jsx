import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Tag } from 'lucide-react';

export default function MentorTopics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/mentor/topics')
      .then((data) => setTopics(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Failed to load topics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8">
      <div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Topics & skills</h1>
          <p className="text-slate-500 text-sm">Topics you can teach or mentor in.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {topics.length > 0 ? (
          topics.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-5 text-center">
                <Tag className="mx-auto h-5 w-5 text-brand-600 mb-2" />
                <div className="font-medium text-slate-900">{t.name}</div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">No topics found.</p>
        )}
      </div>
    </div>
  );
}
