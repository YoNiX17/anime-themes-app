import './Loader.css';

export const Loader: React.FC = () => {
  return (
    <div className="loader-container">
      <div className="skeleton-grid">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="skeleton skeleton-image" />
            <div className="skeleton-content">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-meta" />
              <div className="skeleton-badges">
                <div className="skeleton skeleton-badge" />
                <div className="skeleton skeleton-badge" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
