import React from 'react';

interface FormInputProps {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({ 
  type, 
  placeholder, 
  value, 
  onChange, 
  required = false 
}) => {
  return (
    <div style={{ marginBottom: '20px' }}>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        style={{
          width: '100%',
          padding: '12px 15px',
          border: '1px solid #000',
          borderRadius: '8px',
          fontSize: '16px',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
};

export default FormInput; 