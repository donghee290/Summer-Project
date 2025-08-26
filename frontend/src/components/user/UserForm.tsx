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
      justifyContent: 'flex-start',
      backgroundColor: '#fff',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '40px',
        borderRadius: '8px',
        border: '1px solid #000',
        width: '500px',
        textAlign: 'center',
        paddingLeft: '100px', 
        paddingRight: '100px'
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