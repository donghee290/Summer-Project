// src/pages/community/RepositoryFeedPage.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { dummyPosts } from '../../data/dummyData';

export const RepositoryFeedPage = () => {
  const { repoId } = useParams();
  const navigate = useNavigate();

  const filteredPosts = dummyPosts.filter(
    (post) => post.repository.id === Number(repoId)
  );

  return (
    <div style={{ padding: '20px' }}>
      <h2>저장소 #{repoId}의 게시글</h2>
      {filteredPosts.map((post) => (
        <div
          key={post.id}
          style={{
            border: '1px solid #ccc',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            cursor: 'pointer'
          }}
          onClick={() => navigate(`/community/post/${post.id}`)}
        >
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
            <span>❤️ {post.likes}</span>
            <span>💬 {post.comments}</span>
            <span>작성자: {post.author}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
