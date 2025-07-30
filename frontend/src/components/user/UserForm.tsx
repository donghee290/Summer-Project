import React from 'react';

interface UserFormProps {
  children: React.ReactNode;
  title: string;
  onSubmit?: (e: React.FormEvent) => void;
}

const UserForm: React.FC<UserFormProps> = ({ children, title, onSubmit }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f0f2f5',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
        width: '400px',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '30px', color: '#333' }}>{title}</h2>
        <form onSubmit={onSubmit}>
          {children}
        </form>
      </div>
    </div>
  );
};

export default UserForm; 