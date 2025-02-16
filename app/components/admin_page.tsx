"use client";


import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './admin_page.module.css';
import config from '../config';


const SERVER_BASE = config.serverUrl;


const AdminPage: React.FC = () => {
 const [currentUser, setCurrentUser] = useState(null);
 const [error, setError] = useState('');
 const [users, setUsers] = useState([]);
 const [classes, setClasses] = useState([{ id: 0, name: 'All classes' }]);
 const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(true);


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


 const [searchTerm, setSearchTerm] = useState('');
 const [selectedClass, setSelectedClass] = useState(0); // 0 represents all classes
 const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
 const [actionType, setActionType] = useState<string>('');
 const [balanceAmount, setBalanceAmount] = useState<string>('');
 const router = useRouter();


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


 return error ? (
   <div className={styles.adminContainer}>
     <div className={styles.errorMessage}>{error}</div>
   </div>
 ) : (
   <div className={styles.adminContainer}>
     <div className={styles.header}>
       <div className={styles.userInfo}>
         <div className={styles.nickname}>
           Hello {currentUser}
         </div>
       </div>
     </div>
     <div className={styles.tokenVisibilityToggle}>
       <label>
       Tokens Balance
         <div className={styles.toggle}>
           <input
             type="checkbox"
             checked={isTokenBalanceVisible}
             onChange={async (e) => {
               const newValue = e.target.checked;
               setIsTokenBalanceVisible(newValue);
               try {
                 await fetch(`${SERVER_BASE}/setTokenVisibility`, {
                   method: 'POST',
                   headers: {
                     'Content-Type': 'application/json',
                   },
                   body: JSON.stringify({ isVisible: newValue })
                 });
               } catch (error) {
                 console.error('Error updating token visibility:', error);
               }
             }}
           />
           <div className={styles.slider}>
             <span className={styles.on}>ON</span>
             <span className={styles.off}>OFF</span>
           </div>
         </div>
       </label>
     </div>
     <div className={styles.controlsContainer}>
       {selectedUsers.length > 0 && (
         <div className={styles.bulkActions}>
           <select
             value={actionType}
             onChange={(e) => setActionType(e.target.value)}
             className={styles.actionSelect}
           >
             <option value="">...Choose Action</option>
             <option value="reset_password">Reset Password</option>
             <option value="add_balance">Add Tokens </option>
             <option value="reduce_balance">Reduce Tokens </option>
             <option value="set_balance">Set New Balance </option>
           </select>
          
           {['add_balance', 'reduce_balance', 'set_balance'].includes(actionType) && (
             <input
               type="number"
               value={balanceAmount}
               onChange={(e) => setBalanceAmount(e.target.value)}
               placeholder="Amount"
               className={styles.balanceInput}
             />
           )}


           <button
             onClick={async () => {
               try {
                 if (!actionType) {
                   setError('Please select an action');
                   return;
                 }


                 if (['add_balance', 'reduce_balance', 'set_balance'].includes(actionType) && !balanceAmount) {
                   setError('Please enter an amount');
                   return;
                 }


                 // Prepare the request body with the single action
                 const requestBody = {
                   users: selectedUsers,
                   actions: [{
                     type: actionType,
                     amount: ['add_balance', 'reduce_balance', 'set_balance'].includes(actionType)
                       ? parseInt(balanceAmount)
                       : undefined
                   }]
                 };


                 // Send request to server with multiple actions
                 const response = await fetch('/api/admin/bulk-actions', {
                   method: 'POST',
                   headers: {
                     'Content-Type': 'application/json',
                   },
                   body: JSON.stringify(requestBody)
                 });


                 if (!response.ok) {
                   const errorData = await response.json();
                   throw new Error(errorData.error || 'Failed to perform bulk action');
                 }


                 // Refresh users data after successful action
                 const usersResponse = await fetch(`${SERVER_BASE}/users`);
                 const usersData = await usersResponse.json();
                 setUsers(usersData);


                 // Reset form and clear any previous errors
                 setError('');
                 setActionType('');
                 setBalanceAmount('');
                 setSelectedUsers([]);
               } catch (err) {
                 console.error('Error performing bulk action:', err);
                 setError('Failed to perform action');
               }
             }}
             className={styles.actionButton}
             disabled={!actionType}
           >
             Execute Action
           </button>
         </div>
       )}
      
       <div className={styles.searchContainer}>
         <div className={styles.searchHeader}>
           <input
             type="text"
             placeholder="Enter user's name/email"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className={styles.searchInput}
           />
           <div className={styles.filterGroup}>
             <select
               value={selectedClass}
               onChange={(e) => setSelectedClass(Number(e.target.value))}
               className={styles.classSelect}
             >
               {classes.map(cls => (
                 <option key={cls.id} value={cls.id}>
                   {cls.name}
                 </option>
               ))}
             </select>
           </div>
         </div>
       </div>


       <div className={styles.usersContainer}>
         <div className={styles.usersHeader}>
           <label className={styles.selectAllContainer}>
             <input
               type="checkbox"
               checked={selectedUsers.length === users.filter(user =>
                 (selectedClass === 0 || user.classId === selectedClass) &&
                 (user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 user.email.toLowerCase().includes(searchTerm.toLowerCase()))
               ).length}
               onChange={(e) => {
                 const filteredUsers = users.filter(user =>
                   (selectedClass === 0 || user.classId === selectedClass) &&
                   (user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   user.email.toLowerCase().includes(searchTerm.toLowerCase()))
                 );
                 setSelectedUsers(e.target.checked ? filteredUsers.map(u => u.email) : []);
               }}
             />
              Choose All
           </label>
         </div>
         <div className={styles.usersList}>
           {users
             .filter(user =>
               (selectedClass === 0 || user.classId === selectedClass) &&
               (user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               user.email.toLowerCase().includes(searchTerm.toLowerCase()))
             )
             .map(user => (
               <div key={user.id} className={styles.userCard}>
                 <div className={styles.leftSection}>
                   <input
                     type="checkbox"
                     checked={selectedUsers.includes(user.email)}
                     onChange={(e) => {
                       setSelectedUsers(prev =>
                         e.target.checked
                           ? [...prev, user.email]
                           : prev.filter(email => email !== user.email)
                       );
                     }}
                     className={styles.userCheckbox}
                   />
                   <div className={styles.userBalance}>
                     <span>current balance: </span>{user.balance} tokens
                   </div>
                 </div>
                 <div className={styles.userInfo}>
                   <div className={styles.userEmail}>{user.email}</div>
                   <div className={styles.userName}>{user.name}</div>
                 </div>
               </div>
             ))
           }
         </div>
       </div>
     </div>
   </div>
 );
};
export default AdminPage;



