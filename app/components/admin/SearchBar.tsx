import React from 'react';
import styles from '../admin_page.module.css';
import type { Class } from './types';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedClass: number;
  onClassChange: (classId: number) => void;
  classes: Class[];
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchChange,
  selectedClass,
  onClassChange,
  classes
}) => {
  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchHeader}>
        <input
          type="text"
          placeholder="הכנס מילות חיפוש..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.filterGroup}>
          <select
            value={selectedClass}
            onChange={(e) => onClassChange(Number(e.target.value))}
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
  );
};

export default SearchBar;