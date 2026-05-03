"""
Add pagination to 4 pages: pedidos, clientes, ingredientes, financeiro.
Each page already has filtered lists. We add:
1. Import for Pagination component + paginate helper
2. A currentPage useState 
3. Reset currentPage when filters change
4. Paginate the filtered list
5. Render <Pagination> after the list
"""
import re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)


# ===================== PEDIDOS =====================
def fix_pedidos():
    path = r"c:\projetos\doceria-pro\src\app\(app)\pedidos\page.tsx"
    content = read_file(path)
    
    # 1. Add import after last import
    content = content.replace(
        "import { logSupabaseError } from '@/lib/supabase-error'",
        "import { logSupabaseError } from '@/lib/supabase-error'\nimport { Pagination, paginate } from '@/components/Pagination'"
    )
    
    # 2. Add currentPage state
    content = content.replace(
        "const [isLoading, setIsLoading] = useState(true)\r\n  const [error, setError] = useState('')",
        "const [isLoading, setIsLoading] = useState(true)\r\n  const [error, setError] = useState('')\r\n  const [currentPage, setCurrentPage] = useState(1)"
    )
    
    # 3. Reset page when filters change - add useEffect
    content = content.replace(
        "  const filteredOrders = useMemo(",
        "  useEffect(() => { setCurrentPage(1) }, [selectedStatus, searchQuery])\n\n  const filteredOrders = useMemo("
    )
    
    # 4. Add paged list computation after filteredOrders
    content = content.replace(
        "  async function deleteOrder(id: string)",
        "  const { paged: pagedOrders, totalPages } = paginate(filteredOrders, currentPage)\n\n  async function deleteOrder(id: string)"
    )
    
    # 5. Replace filteredOrders.length === 0 check
    content = content.replace(
        "filteredOrders.length === 0 ?",
        "pagedOrders.length === 0 && filteredOrders.length === 0 ?"
    )
    
    # 6. Replace filteredOrders.map with pagedOrders.map
    content = content.replace(
        "{filteredOrders.map((order)",
        "{pagedOrders.map((order)"
    )
    
    # 7. Add Pagination component after the list div
    content = content.replace(
        "          </div>\n        )}\n      </main>",
        "          </div>\n\n            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />\n        )}\n      </main>"
    )
    
    write_file(path, content)
    print("  UPDATED: pedidos/page.tsx")


# ===================== CLIENTES =====================
def fix_clientes():
    path = r"c:\projetos\doceria-pro\src\app\(app)\clientes\page.tsx"
    content = read_file(path)
    
    # 1. Add import
    content = content.replace(
        "import { logSupabaseError } from '@/lib/supabase-error'",
        "import { logSupabaseError } from '@/lib/supabase-error'\nimport { Pagination, paginate } from '@/components/Pagination'"
    )
    
    # 2. Add currentPage state
    content = content.replace(
        "const [isLoading, setIsLoading] = useState(true)\r\n  const [editingId,",
        "const [isLoading, setIsLoading] = useState(true)\r\n  const [currentPage, setCurrentPage] = useState(1)\r\n  const [editingId,"
    )
    
    # 3. Reset page when search changes
    content = content.replace(
        "  const filteredCustomers = useMemo(",
        "  useEffect(() => { setCurrentPage(1) }, [searchQuery])\n\n  const filteredCustomers = useMemo("
    )
    
    # 4. Add paged computation after filteredCustomers
    content = content.replace(
        "  const ordersByCustomerId = useMemo(",
        "  const { paged: pagedCustomers, totalPages } = paginate(filteredCustomers, currentPage)\n\n  const ordersByCustomerId = useMemo("
    )
    
    # 5. Replace empty check
    content = content.replace(
        "filteredCustomers.length === 0 ?",
        "pagedCustomers.length === 0 && filteredCustomers.length === 0 ?"
    )
    
    # 6. Replace map
    content = content.replace(
        "{filteredCustomers.map((customer)",
        "{pagedCustomers.map((customer)"
    )
    
    # 7. Add Pagination after list
    content = content.replace(
        "          </div>\r\n        )}\r\n      </main>",
        "          </div>\n\n            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />\r\n        )}\r\n      </main>"
    )
    
    write_file(path, content)
    print("  UPDATED: clientes/page.tsx")


# ===================== INGREDIENTES =====================
def fix_ingredientes():
    path = r"c:\projetos\doceria-pro\src\app\(app)\ingredientes\page.tsx"
    content = read_file(path)
    
    # 1. Add import
    content = content.replace(
        "import { logSupabaseError } from '@/lib/supabase-error'",
        "import { logSupabaseError } from '@/lib/supabase-error'\nimport { Pagination, paginate } from '@/components/Pagination'"
    )
    
    # 2. Add currentPage state
    content = content.replace(
        "const [isLoading, setIsLoading] = useState(true)\r\n  const [error, setError] = useState('')\r\n  const supabase",
        "const [isLoading, setIsLoading] = useState(true)\r\n  const [error, setError] = useState('')\r\n  const [currentPage, setCurrentPage] = useState(1)\r\n  const supabase"
    )
    
    # 3. Reset page when filters change
    content = content.replace(
        "  const filteredIngredients = useMemo(",
        "  useEffect(() => { setCurrentPage(1) }, [searchQuery, supplierFilter])\n\n  const filteredIngredients = useMemo("
    )
    
    # 4. Add paged computation 
    content = content.replace(
        "  const supplierById = useMemo(",
        "  const { paged: pagedIngredients, totalPages } = paginate(filteredIngredients, currentPage)\n\n  const supplierById = useMemo("
    )
    
    # 5. Replace empty check
    content = content.replace(
        "filteredIngredients.length === 0 ?",
        "pagedIngredients.length === 0 && filteredIngredients.length === 0 ?"
    )
    
    # 6. Replace map
    content = content.replace(
        "{filteredIngredients.map((ingredient)",
        "{pagedIngredients.map((ingredient)"
    )
    
    # 7. Add Pagination
    content = content.replace(
        "          </div>\r\n        )}\r\n      </main>",
        "          </div>\n\n            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />\r\n        )}\r\n      </main>"
    )
    
    write_file(path, content)
    print("  UPDATED: ingredientes/page.tsx")


# ===================== FINANCEIRO =====================
def fix_financeiro():
    path = r"c:\projetos\doceria-pro\src\app\(app)\financeiro\page.tsx"
    content = read_file(path)
    
    # 1. Add import
    content = content.replace(
        "import { createClient } from '@/lib/supabase/client'",
        "import { createClient } from '@/lib/supabase/client'\nimport { Pagination, paginate } from '@/components/Pagination'"
    )
    
    # 2. Find the component function and add state. The financeiro page has many states.
    content = content.replace(
        "const [isLoadingReport, setIsLoadingReport] = useState(false)",
        "const [isLoadingReport, setIsLoadingReport] = useState(false)\r\n  const [currentPage, setCurrentPage] = useState(1)"
    )
    
    # 3. Reset page when filters change
    content = content.replace(
        "  const filteredTransactions = useMemo(",
        "  useEffect(() => { setCurrentPage(1) }, [searchQuery, typeFilter, categoryFilter])\n\n  const filteredTransactions = useMemo("
    )
    
    # 4. Add paged computation after filteredTransactions
    content = content.replace(
        "  const summary = useMemo(",
        "  const { paged: pagedTransactions, totalPages: transactionPages } = paginate(filteredTransactions, currentPage)\n\n  const summary = useMemo("
    )
    
    # 5. Replace empty check
    content = content.replace(
        "filteredTransactions.length === 0 ?",
        "pagedTransactions.length === 0 && filteredTransactions.length === 0 ?"
    )
    
    # 6. Replace map
    content = content.replace(
        "{filteredTransactions.map((transaction)",
        "{pagedTransactions.map((transaction)"
    )
    
    # 7. Add Pagination after transaction list
    content = content.replace(
        "          </div>\r\n        )}\r\n      </main>",
        "          </div>\n\n            <Pagination currentPage={currentPage} totalPages={transactionPages} onPageChange={setCurrentPage} />\r\n        )}\r\n      </main>"
    )
    
    write_file(path, content)
    print("  UPDATED: financeiro/page.tsx")


if __name__ == '__main__':
    fix_pedidos()
    fix_clientes()
    fix_ingredientes()
    fix_financeiro()
    print("\nDone! 4 pages updated with pagination.")
