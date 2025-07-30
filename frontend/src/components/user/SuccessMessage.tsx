import React from 'react';

interface SuccessMessageProps {
  message: string;
}

const SuccessMessage: React.FC<SuccessMessageProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div style={{
      backgroundColor: '#d4edda',
      color: '#155724',
      padding: '10px',
      borderRadius: '5px',
      marginBottom: '20px',
      fontSize: '14px'
    }}>
      {message}
    </div>
  );
};

export default SuccessMessage; 