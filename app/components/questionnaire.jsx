import React, { useState } from 'react';
import styled from 'styled-components';
import SatisfactionScale from './ScaleQuestion'; // Import the SatisfactionScale component
import { useRouter } from 'next/navigation';

// Styled components
const QuestionnaireContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 16px;
  margin: auto;
  direction: rtl;
`;

const Title = styled.h2`
  color: #003366;
  font-size: 1.5rem;
  margin-bottom: 20px;
`;

const FormSection = styled.div`
  width: 110%;
  margin-bottom: 20px;
`;

const Label = styled.label`
  font-size: 1rem;
  color: #333;
  display: block;
  margin-bottom: 5px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border-radius: 60px;
  border: 2px solid transparent;
  font-size: 1em;
  background-color: #e6f1f7;
  transition: border-color 0.3s ease;
  margin-bottom: 10px;
  &:focus {
    outline: none;
    border-color: #000;
    background-color: white;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 12px;
  border-radius: 60px;
  border: 2px solid transparent;
  font-size: 1em;
  background-color: #e6f1f7;
  transition: border-color 0.3s ease;
  margin-bottom: 10px;
  &:focus {
    outline: none;
    border-color: #000;
    background-color: white;
  }
`;

const SubmitButton = styled.button`
  background-color: #003366;
  color: white;
  padding: 12px 20px;
  border: none;
  border-radius: 60px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
  width: 100%;
  &:hover {
    background-color: #002244;
  }
`;

const SERVER_BASE = "https://mentor-server-theta.vercel.app";

const Questionnaire = () => {
    const router = useRouter();
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        idCode: '',
        gender: '',
        birthYear: '',
        preferredLanguage: '',
        worksInIndustry: '',
        aiUsage: '',
        statements: {
        aiLearningPotential: 3,
        aiEaseOfUse: 3,
        aiComplexity: 3,
        aiLearningImprovement: 3,
        selfLearningComfort: 3,
        selfLearningWithTech: 3,
        selfLearningWithAI: 3,
        aiDecisionComfort: 3,
        aiTrustworthiness: 3,
        aiIndependencePreference: 3,
        },
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({
        ...prev,
        [name]: value,
        }));
    };

    const handleStatementChange = (name, value) => {
        setForm((prev) => ({
        ...prev,
        statements: {
            ...prev.statements,
            [name]: value,
        },
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Submitted form data:', form);

        let currentUser = JSON.parse(localStorage.getItem("currentUser"))

        fetch(`${SERVER_BASE}/saveUserForm`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "user": currentUser,
                "form": form
            })
        }).then(response => response.json()).then(ans => {
            if (ans["status"]) {
                router.push('/entities/basic-chat');
            } else {
                // handle
            }
        })

        
    };

  return (
    <QuestionnaireContainer>
      <Title>שאלון</Title>
      <form onSubmit={handleSubmit}>

        {/* Section 1 - General Information */}
        <FormSection>
          <Label>שם פרטי:</Label>
          <Input
            type="text"
            name="firstName"
            value={form.firstName}
            onChange={handleInputChange}
            placeholder="הזן שם פרטי"
          />

          <Label>שם משפחה:</Label>
          <Input
            type="text"
            name="lastName"
            value={form.lastName}
            onChange={handleInputChange}
            placeholder="הזן שם משפחה"
          />

          <Label>קוד מזהה (4 ספרות אחרונות):</Label>
          <Input
            type="text"
            name="idCode"
            value={form.idCode}
            onChange={handleInputChange}
            placeholder="הזן 4 ספרות אחרונות של ת.ז"
          />

          <Label>מגדר:</Label>
          <Select
            name="gender"
            value={form.gender}
            onChange={handleInputChange}
          >
            <option value="">בחר</option>
            <option value="male">זכר</option>
            <option value="female">נקבה</option>
            <option value="other">אחר</option>
            <option value="prefer_not_to_say">מעדיפ/ה לא להגיד</option>
          </Select>

          <Label>שנת לידה:</Label>
          <Input
            type="number"
            name="birthYear"
            value={form.birthYear}
            onChange={handleInputChange}
            placeholder="הזן שנת לידה"
          />

          <Label>באיזו שפה נוח לך לעבוד עם מייקל?</Label>
          <Select
            name="preferredLanguage"
            value={form.preferredLanguage}
            onChange={handleInputChange}
          >
            <option value="">בחר</option>
            <option value="hebrew">עברית</option>
            <option value="english">אנגלית</option>
            <option value="arabic">ערבית</option>
          </Select>

          <Label>האם אתה עובד בתחום בתעשייה?</Label>
          <Select
            name="worksInIndustry"
            value={form.worksInIndustry}
            onChange={handleInputChange}
          >
            <option value="">בחר</option>
            <option value="yes">כן</option>
            <option value="no">לא</option>
          </Select>

          <Label>האם אתה משתמש בכלי בינה מלאכותית?</Label>
          <Select
            name="aiUsage"
            value={form.aiUsage}
            onChange={handleInputChange}
          >
            <option value="">בחר</option>
            <option value="yes">כן</option>
            <option value="no">לא</option>
          </Select>
        </FormSection>

        {/* Section 2 - Statements with SatisfactionScale component */}
        <FormSection>
          <u><Label style={{fontWeight: "bold"}}>תפיסת התועלת והקלות בשימוש בכלים ללמידה מבוססת AI</Label></u>
          <SatisfactionScale
            question="כלי בינה מלאכותית יכולים לשפר את יכולות הלמידה שלי."
            name="aiLearningPotential"
            onChange={(value) => handleStatementChange("aiLearningPotential", value)}
          />

          <SatisfactionScale
            question="השימוש בבוט AI גורם ללמידה שלי להיות קלה ונגישה יותר."
            name="aiEaseOfUse"
            onChange={(value) => handleStatementChange("aiEaseOfUse", value)}
          />

          <SatisfactionScale
            question="הכלים מבוססי AI מורכבים מדי לשימוש עבורי."
            name="aiComplexity"
            onChange={(value) => handleStatementChange("aiComplexity", value)}
          />

          <SatisfactionScale
            question="למידה באמצעות AI יכולה לשפר את ההישגים שלי."
            name="aiLearningImprovement"
            onChange={(value) => handleStatementChange("aiLearningImprovement", value)}
          />

          <SatisfactionScale
            question="אני מרגיש/ה בנוח ללמוד חומר חדש באופן עצמאי."
            name="selfLearningComfort"
            onChange={(value) => handleStatementChange("selfLearningComfort", value)}
          />

          <SatisfactionScale
            question="יש לי את היכולת ללמד את עצמי נושאים חדשים בעזרת כלים טכנולוגיים."
            name="selfLearningWithTech"
            onChange={(value) => handleStatementChange("selfLearningWithTech", value)}
          />

          <SatisfactionScale
            question="קשה לי ללמוד לבד בעזרת AI, ואני זקוק/ה להכוונה אנושית."
            name="selfLearningWithAI"
            onChange={(value) => handleStatementChange("selfLearningWithAI", value)}
          />

          <SatisfactionScale
            question="אני מרגיש/ה בנוח כשבוט AI עוזר לי לקבל החלטות לימודיות."
            name="aiDecisionComfort"
            onChange={(value) => handleStatementChange("aiDecisionComfort", value)}
          />

          <SatisfactionScale
            question="אני סומך/ת על AI שתיתן לי המלצות מושכלות."
            name="aiTrustworthiness"
            onChange={(value) => handleStatementChange("aiTrustworthiness", value)}
          />

          <SatisfactionScale
            question="אני מעדיפ/ה לקבל החלטות לבד, בלי מעורבות AI."
            name="aiIndependencePreference"
            onChange={(value) => handleStatementChange("aiIndependencePreference", value)}
          />
        </FormSection>

        <SubmitButton type="submit">שלח</SubmitButton>
      </form>
    </QuestionnaireContainer>
  );
};

export default Questionnaire;
