import pandas as pd

# Basic reading of Excel file
df = pd.read_excel(r'C:\Users\LiorBenShimon\Documents\Airbnb Project\Tableau Full Project.xlsx')
print("\nBasic read:")
print(df)

# Reading with specific sheet name
df_sheet = pd.read_excel(r'C:\Users\LiorBenShimon\Documents\Airbnb Project\Tableau Full Project.xlsx', sheet_name=0)  # First sheet
print("\nReading specific sheet:")
print(df_sheet)

# Reading specific columns (adjust column names based on your Excel file)
df_cols = pd.read_excel(r'C:\Users\LiorBenShimon\Documents\Airbnb Project\Tableau Full Project.xlsx', usecols=[0, 1])  # First two columns
print("\nReading specific columns:")
print(df_cols)

# Reading specific rows
df_rows = pd.read_excel(r'C:\Users\LiorBenShimon\Documents\Airbnb Project\Tableau Full Project.xlsx', nrows=5)  # Read first 5 rows
print("\nReading first 5 rows:")
print(df_rows)
