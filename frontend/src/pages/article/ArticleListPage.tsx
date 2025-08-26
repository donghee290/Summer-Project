// src/pages/article/ArticleListPage.tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useArticleStore } from '../../store/articleStore';

export default function ArticleListPage() {
  console.log('[ArticleListPage] render');
  const { list, pagination, loading, error, loadList } = useArticleStore();



  
  useEffect(() => {
    console.log('[ArticleListPage] useEffect → loadList');
    loadList(1,20 );
  }, [loadList]);

  if (loading) return <div>로딩 중…</div>;
  if (error) return <div>에러: {error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>아티클 목록</h1>
      <ul style={{ display: 'grid', gap: 12, listStyle: 'none', padding: 0 }}>
        {(list ?? []).map((a: any) => {
          const articleId = a.id ?? a.article_no;
          const title = a.title ?? a.article_title;
          const summary = a.summary ?? a.article_summary;

          return (
            <li key={articleId} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
              <Link to={`/articles/${articleId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <h3>{title}</h3>
                <p style={{ whiteSpace: 'pre-line', color: '#555' }}>{summary}</p>
              </Link>
            </li>
          );
        })}
      </ul>

      {pagination && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            disabled={pagination.page <= 1}
            onClick={() => loadList(pagination.page - 1, pagination.limit )}
          >
            이전
          </button>
          <span>
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => loadList(pagination.page + 1, pagination.limit )}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}