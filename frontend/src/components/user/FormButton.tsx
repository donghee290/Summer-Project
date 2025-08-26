import React from 'react';

interface FormButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'text';
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

const FormButton: React.FC<FormButtonProps> = ({ 
  onClick, 
  disabled = false, 
  children, 
  variant = 'primary',
  fullWidth = true,
  style
}) => {
  const getButtonStyle = () => {
    const baseStyle = {
      width: fullWidth ? '100%' : 'auto',
      padding: '12px',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background-color 0.3s ease',
      marginBottom: '5px',
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? '#ccc' : '#001E4F',
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
          color: 'black',
          fontSize: '18px',
          padding: '10px',
          textDecoration: 'underline'
        };
      default:
        return baseStyle;
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...getButtonStyle(), ...(style || {}) }}
    >
      {children}
    </button>
  );
};

export default FormButton; 