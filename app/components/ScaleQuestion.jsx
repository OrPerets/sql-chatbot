import React, { useState } from 'react';
import styled from 'styled-components';

const ScaleContainer = styled.div`
  text-align: center;
  margin: 1rem 0;
`;

const QuestionText = styled.div`
  font-size: 1rem;
  margin-bottom: 0.5rem;
`;

const ScaleLabels = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #555;
  margin: 0 1.5rem;
`;

const ScaleButtons = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0.5rem 0;
`;

const RadioButton = styled.input`
  display: none;

  &:checked + label {
    background-color: #4a90e2;
    color: white;
    border-color: #4a90e2;
  }
`;

const RadioButtonLabel = styled.label`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid #ccc;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.9rem;
  color: #333;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background-color: #f0f8ff;
  }
`;

const SatisfactionScale = ({ question, name, onChange }) => {
  const [selectedValue, setSelectedValue] = useState(null);

  const handleChange = (e) => {
    const value = Number(e.target.value);
    setSelectedValue(value);
    if (onChange) onChange(value); // Pass the value up if an onChange handler is provided
  };

  return (
    <ScaleContainer style={{marginTop: "5%", paddingBottom: "2%"}}>
      <QuestionText>{question}</QuestionText>
      <ScaleLabels>
        <span>לא מסכים</span>
        <span>מסכים מאוד</span>
      </ScaleLabels>
      <ScaleButtons>
        {[1, 2, 3, 4, 5].map((value) => (
          <React.Fragment key={value}>
            <RadioButton
              type="radio"
              id={`${name}-${value}`}
              name={name}
              value={value}
              checked={selectedValue === value}
              onChange={handleChange}
            />
            <RadioButtonLabel htmlFor={`${name}-${value}`}>{value}</RadioButtonLabel>
          </React.Fragment>
        ))}
      </ScaleButtons>
    </ScaleContainer>
  );
};

export default SatisfactionScale;
