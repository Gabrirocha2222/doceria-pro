import re

files = [
    r"c:\projetos\doceria-pro\src\app\(app)\clientes\page.tsx",
    r"c:\projetos\doceria-pro\src\app\(app)\financeiro\page.tsx",
    r"c:\projetos\doceria-pro\src\app\(app)\ingredientes\page.tsx",
    r"c:\projetos\doceria-pro\src\app\(app)\pedidos\page.tsx"
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find where to insert
    # Usually we have `const [error, setError] = useState('')`
    # Check if currentPage is already there
    if "const [currentPage, setCurrentPage]" not in content:
        content = re.sub(
            r"(const \[error, setError\] = useState\(''\))",
            r"\1\n  const [currentPage, setCurrentPage] = useState(1)",
            content
        )
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")
