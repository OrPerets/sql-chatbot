export interface User {
  id: string;
  email: string;
  name: string;
  firstName: string;
  classId: number;
  coins: number;
}

export interface Class {
  id: number;
  name: string;
}