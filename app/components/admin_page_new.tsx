"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './admin_page.module.css';
import config from '../config';
import TokenVisibilityToggle from './admin/TokenVisibilityToggle';
import UsersList from './admin/UsersList';
import BulkActions from './admin/BulkActions';
import type { User, Class } from './admin/types';

const SERVER_BASE = config.serverUrl;

const AdminPage: React.FC = () => {
 const [currentUser, setCurrentUser] = useState<string | null>(null);
 const [error, setError] = useState('');
 const [users, setUsers] = useState<User[]>([]);
 const [classes, setClasses] = useState<Class[]>([{ id: 0, name: 'כל הכיתות' }]);
 const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedClass, setSelectedClass] = useState(0); // 0 represents all classes
 const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
 
 const router = useRouter();

 // Fetch initial token visibility state
 useEffect(() => {
   fetch(`${SERVER_BASE}/getTokenVisibility`)
     .then(response => response.json())
     .then(data => setIsTokenBalanceVisible(data.isVisible))
     .catch(error => console.error('Error fetching token visibility:', error));
 }, []);

 // Fetch users and classes data
 useEffect(() => {
   const fetchData = async () => {
     try {
       // Fetch users
       const usersResponse = await fetch(`${SERVER_BASE}/allUsers`);
       const usersData = await usersResponse.json();

       const coinsData = await fetch(`${SERVER_BASE}/getAllCoins`);
       const coins = await coinsData.json();
       usersData.forEach(user => {
        let temp = coins.filter(item => item.user === user.email)
        if (temp.length > 0) {
          user.coins = temp[0]["coins"]
        } else {
          user.coins = 0;
        }
       });
       setUsers(usersData);

       try {
         // Fetch classes if endpoint exists-- needs to add classes column to the users table
         const classesResponse = await fetch(`${SERVER_BASE}/classes`);
         if (classesResponse.ok) {
           const classesData = await classesResponse.json();
           setClasses([{ id: 0, name: 'כל הכיתות' }, ...classesData]);
         }
       } catch (classErr) {
         console.log('Classes endpoint not available yet');
         // Continue with default class only
       }
     } catch (err) {
       console.error('Error fetching users:', err);
       setError('Failed to fetch users');
     }
   };

   fetchData();
 }, []);

 useEffect(() => {
   const storedUser = localStorage.getItem("currentUser");
   if (!storedUser) {
     router.push('/login');
     return;
   }

   const user = JSON.parse(storedUser);
  
   // For now using a placeholder check -needs to check if keeping it in a list version or a db version
   const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com"," roeizer@shenkar.ac.il"];
   const isAdmin = adminEmails.includes(user.email);
  
   if (!isAdmin) {
     setError('אין לך הרשאת גישה לממשק המנהל');
     setTimeout(() => {
       router.push('/login');
     }, 3000);
     return;
   }

   setCurrentUser(user.name);
 }, [router]);

 const handleBulkActionSuccess = () => {
   setError('');
   setSelectedUsers([]);
   // Refresh users data
   fetchData();
 };

 const fetchData = async () => {
   try {
     const usersResponse = await fetch(`${SERVER_BASE}/allUsers`);
     const usersData = await usersResponse.json();

     const coinsData = await fetch(`${SERVER_BASE}/getAllCoins`);
     const coins = await coinsData.json();
     usersData.forEach(user => {
       let temp = coins.filter(item => item.user === user.email)
       if (temp.length > 0) {
         user.coins = temp[0]["coins"]
       } else {
         user.coins = 0;
       }
     });
     setUsers(usersData);
   } catch (err) {
     console.error('Error refreshing users:', err);
   }
 };

 return error ? (
   <div className={styles.adminContainer}>
     <div className={styles.errorMessage}>{error}</div>
   </div>
 ) : (
   <div className={styles.adminContainer}>
     <div className={styles.header}>
       <div className={styles.userInfo}>
         <div className={styles.nickname}>
           היי {currentUser}
         </div>
       </div>
     </div>

     <TokenVisibilityToggle 
       isVisible={isTokenBalanceVisible}
       onToggle={setIsTokenBalanceVisible}
     />

     <div className={styles.controlsContainer}>
       {selectedUsers.length > 0 && (
         <BulkActions
           selectedUsers={selectedUsers}
           onSuccess={handleBulkActionSuccess}
           onError={setError}
         />
       )}
      
       <SearchBar
         searchTerm={searchTerm}
         onSearchChange={setSearchTerm}
         selectedClass={selectedClass}
         onClassChange={setSelectedClass}
         classes={classes}
       />

       <UsersList
         users={users}
         selectedUsers={selectedUsers}
         setSelectedUsers={setSelectedUsers}
         searchTerm={searchTerm}
         selectedClass={selectedClass}
       />
     </div>
   </div>
 );
};

export default AdminPage;