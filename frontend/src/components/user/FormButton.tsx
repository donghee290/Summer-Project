import React from 'react';

interface FormButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'text';
  fullWidth?: boolean;
}

const FormButton: React.FC<FormButtonProps> = ({ 
  onClick, 
  disabled = false, 
  children, 
  variant = 'primary',
  fullWidth = true
}) => {
  const getButtonStyle = () => {
    const baseStyle = {
      width: fullWidth ? '100%' : 'auto',
      padding: '12px',
      border: 'none',
      borderRadius: '5px',
      fontSize: '16px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background-color 0.3s ease',
      marginBottom: '15px'
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? '#ccc' : '#007bff',
          color: '#fff'
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? '#ccc' : '#6c757d',
          color: '#fff'
        };
      case 'text':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          color: 'gray',
          fontSize: '15px',
          padding: '10px'
        };
      default:
        return baseStyle;
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={getButtonStyle()}
    >
      {children}
    </button>
  );
};

export default FormButton; 