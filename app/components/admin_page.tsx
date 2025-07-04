"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Users, Settings, BarChart3 } from 'lucide-react';
import styles from './admin_page.module.css';
import config from '../config';

const SERVER_BASE = config.serverUrl;

const options = {
  'add_balance': 'הוסף מטבעות',
  'reduce_balance': 'הפחת מטבעות',
  'reset_password': 'איפוס סיסמה'
}

const AdminPage: React.FC = () => {
 const [currentUser, setCurrentUser] = useState(null);
 const [error, setError] = useState('');
 const [users, setUsers] = useState([]);
 const [classes, setClasses] = useState([{ id: 0, name: 'All classes' }]);
 const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(true);
 const [isStatuseVisible, setIsStatusVisible] = useState(true);
 const [successMessage, setSuccessMessage] = useState('');

 // Fetch initial token visibility state
 useEffect(() => {
   fetch(`${SERVER_BASE}/getCoinsStatus`)
     .then(response => response.json())
     .then(data => setIsTokenBalanceVisible(data["status"] === "ON"))
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

     try {
      const response = await fetch(SERVER_BASE + "/getStatus" , {
        method: 'GET',
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      const data = await response.json();
      if (data["status"] === 'ON') {
        setIsStatusVisible(true);
      
      } else {
        setIsStatusVisible(false);
      }
    } catch (error) {
      setError('Failed to fetch status. Please try again.');
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

 const updateCoinsStatus = (value) => {
  fetch(`${SERVER_BASE}/setCoinsStatus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ newStatus: value ? "ON" : "OFF"})
  });
 }

 const handleLogout = () => {
   localStorage.removeItem("currentUser");
   router.push('/');
 };

 return error ? (
   <div className={styles.adminContainer}>
     <div className={styles.errorMessage}>{error}</div>
   </div>
 ) : (
   <div className={styles.adminContainer}>
     {/* Sticky Navigation Header */}
     <div className={styles.stickyNav}>
       <div className={styles.navContent}>
         <div className={styles.navLeft}>
           <button 
             onClick={handleLogout}
             className={styles.logoutButton}
           >
             <LogOut size={20} />
             יציאה
           </button>
         </div>
         <div className={styles.navCenter}>
           <BarChart3 size={24} />
           <h1 className={styles.navTitle}>ממשק ניהול - Michael AI</h1>
         </div>
         <div className={styles.navRight}>
           <div className={styles.userWelcome}>
             <Users size={18} />
             היי {currentUser}
           </div>
         </div>
       </div>
     </div>

     {/* Main Content */}
     <div className={styles.mainContent}>
       {/* Control Toggles */}
       <div className={styles.controlsRow}>
         <div className={styles.controlCard}>
           <div className={styles.controlHeader}>
             <Settings size={20} />
             <span>הגדרות מערכת</span>
           </div>
           <div className={styles.togglesContainer}>
             <div className={styles.toggleItem}>
               <label>
                 מטבעות וירטואלים
                 <div className={styles.toggle}>
                   <input
                     type="checkbox"
                     checked={isTokenBalanceVisible}
                     onChange={async (e) => {
                       const newValue = e.target.checked;
                       setIsTokenBalanceVisible(newValue);
                       updateCoinsStatus(newValue)
                     }}
                   />
                   <div className={styles.slider}>
                     <span className={styles.on}></span>
                     <span className={styles.off}></span>
                   </div>
                 </div>
               </label>
             </div>
             <div className={styles.toggleItem}>
               <label>
                 מייקל
                 <div className={styles.toggle}>
                   <input
                     type="checkbox"
                     checked={isStatuseVisible}
                     onChange={async (e) => {
                       const newValue = e.target.checked;
                       setIsStatusVisible(newValue);
                       try {
                         await fetch(`${SERVER_BASE}/setStatus`, {
                           method: 'POST',
                           headers: {
                             'Content-Type': 'application/json',
                           },
                           body: JSON.stringify({ newStatus: newValue ? "ON" : "OFF"})
                         });
                       } catch (error) {
                         console.error('Error updating status:', error);
                       }
                     }}
                   />
                   <div className={styles.slider}>
                     <span className={styles.on}></span>
                     <span className={styles.off}></span>
                   </div>
                 </div>
               </label>
             </div>
           </div>
         </div>
         
         <div className={styles.controlCard}>
           <div className={styles.controlHeader}>
             <BarChart3 size={20} />
             <span>ניהול שאלות</span>
           </div>
           <div className={styles.questionManagement}>
             <button
               onClick={() => router.push('/admin/questions')}
               className={styles.questionsButton}
             >
               אישור שאלות בחינה
             </button>
           </div>
         </div>
       </div>

       {successMessage && <div className={styles.successMessage}>{successMessage}</div>}
       
       <div className={styles.controlsContainer}>
         {selectedUsers.length > 0 && (
           <div className={styles.bulkActions}>
             <select
               value={actionType}
               onChange={(e) => setActionType(e.target.value)}
               className={styles.actionSelect}
             >
               <option value="">בחר אפשרות</option>
               {Object.keys(options).map(option => (
                 <option key={option} value={option}>
                   {options[option]}
                 </option>
               ))}
             </select>
            
             {Object.keys(options).includes(actionType) && (
               <input
                 type="number"
                 value={balanceAmount}
                 onChange={(e) => setBalanceAmount(e.target.value)}
                 placeholder="כמות"
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

                   if (actionType === "reset_password") {
                    await fetch(SERVER_BASE + '/updatePasswordToMany', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ emails: selectedUsers})
                   })
                  } else {

                   // Prepare the request body with the single action
                   const requestBody = {
                     users: selectedUsers,
                     type: actionType,
                     amount: parseInt(balanceAmount)
                   };

                   // Send request to server with multiple actions
                   const response = await fetch(SERVER_BASE + '/admin/changeBalance', {
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
                   }

                   // Refresh users data after successful action
                   const usersResponse = await fetch(`${SERVER_BASE}/allUsers`);
                   const usersData = await usersResponse.json();
                   setUsers(usersData);

                   // Reset form and clear any previous errors
                   setError('');
                   setActionType('');
                   setBalanceAmount('');
                   setSelectedUsers([]);
                   setSuccessMessage('הפעולה בוצעה בהצלחה! ✅');
                   setTimeout(() => setSuccessMessage(''), 3000);
                 } catch (err) {
                   console.error('Error performing bulk action:', err);
                   setError('Failed to perform action');
                 }
               }}
               className={styles.actionButton}
               disabled={!actionType}
             >
               אישור
             </button>
           </div>
         )}
        
         <div className={styles.searchContainer}>
           <div className={styles.searchHeader}>
             <input
               type="text"
               placeholder="הכנס מילות חיפוש..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className={styles.searchInput}
             />
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
             בחר הכל
             </label>
           </div>
           <div className={styles.usersList}>
             {(() => {
               const filteredUsers = users.filter(user =>
                 (selectedClass === 0 || user.classId === selectedClass) &&
                 (user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 user.email.toLowerCase().includes(searchTerm.toLowerCase()))
               );

               if (filteredUsers.length === 0) {
                 return (
                   <div className={styles.noResults}>
                     <div className={styles.noResultsIcon}>🔍</div>
                     <div className={styles.noResultsText}>
                       {searchTerm ? 'לא נמצאו תוצאות עבור החיפוש' : 'אין משתמשים להצגה'}
                     </div>
                     {searchTerm && (
                       <div className={styles.noResultsSubtext}>
                         נסה לחפש במילות חיפוש אחרות
                       </div>
                     )}
                   </div>
                 );
               }

               return filteredUsers.map(user => (
                 <div key={user.id} className={styles.userCard}>
                   <div className={styles.userInfo}>
                     <div className={styles.userName}>{user.name || user.firstName}</div>
                     <div className={styles.userEmail}>{user.email}</div>
                   </div>
                   <div className={styles.leftSection}>
                     <div className={styles.userBalance}>
                       <span className={styles.balanceLabel}>יתרה:</span>
                       <span className={styles.balanceValue}>{user.coins}</span>
                     </div>
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
                   </div>
                 </div>
               ));
             })()}
           </div>
         </div>
       </div>
     </div>
   </div>
 );
};
export default AdminPage;



