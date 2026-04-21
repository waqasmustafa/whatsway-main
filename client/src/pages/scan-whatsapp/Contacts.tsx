import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { 
  Users, 
  Plus, 
  Trash2, 
  Search, 
  Loader2, 
  Upload,
  FileSpreadsheet,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ScanContacts() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [listName, setListName] = useState("");
  const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contactLists, isLoading } = useQuery<any[]>({
    queryKey: ["/api/scan-contacts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/scan-contacts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-contacts"] });
      setIsModalOpen(false);
      resetForm();
      toast({ title: "Success", description: "Contact list imported successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/scan-contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-contacts"] });
      toast({ title: "Deleted", description: "Contact list removed" });
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    Papa.parse(file, {
      complete: (results) => {
        // Find phone numbers in any column
        const numbers: string[] = [];
        results.data.forEach((row: any) => {
          Object.values(row).forEach((val: any) => {
            const clean = String(val).replace(/\D/g, "");
            if (clean.length >= 10 && clean.length <= 15) {
              numbers.push(clean);
            }
          });
        });
        
        const uniqueNumbers = [...new Set(numbers)];
        setParsedNumbers(uniqueNumbers);
        
        if (uniqueNumbers.length === 0) {
          toast({ 
            title: "No numbers found", 
            description: "We couldn't find any valid phone numbers in the CSV.", 
            variant: "destructive" 
          });
        }
      },
      header: true,
      skipEmptyLines: true
    });
  };

  const resetForm = () => {
    setListName("");
    setParsedNumbers([]);
    setFileName("");
  };

  const filteredLists = contactLists?.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Contacts</h1>
          <p className="text-gray-500">Manage your contact lists for bulk messaging.</p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Import Contact List
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Import New Contact List</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">List Name</label>
                <Input 
                  placeholder="e.g. Summer Sale Leads" 
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium">Upload CSV File</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors relative cursor-pointer group">
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleFileUpload}
                  />
                  {fileName ? (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-2">
                        <Check className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{fileName}</p>
                      <p className="text-xs text-green-600 font-semibold mt-1">{parsedNumbers.length} contacts found</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-12 h-12 text-gray-300 group-hover:text-blue-400 mb-2" />
                      <p className="text-sm text-gray-600">Click or drag CSV file here</p>
                      <p className="text-xs text-gray-400 mt-1">Numbers will be auto-detected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!listName || parsedNumbers.length === 0 || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: listName, phoneNumbers: parsedNumbers })}
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Import Contacts
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input 
          className="pl-10 text-gray-900" 
          placeholder="Search contact lists..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredLists?.length === 0 ? (
        <Card className="border-dashed flex flex-col items-center justify-center py-20">
          <Users className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No contact lists found</h3>
          <p className="text-gray-500">Import your first CSV to start sending campaigns.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLists?.map((list) => (
            <Card key={list.id} className="hover:shadow-md transition-all group overflow-hidden border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold truncate text-gray-900">{list.name}</CardTitle>
                  <CardDescription className="flex items-center text-blue-600 font-medium">
                    <Users className="w-3 h-3 mr-1" />
                    {list.phoneNumbers?.length || 0} Contacts
                  </CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteMutation.mutate(list.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="pt-4 border-t border-gray-50 bg-gray-50/30">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center">
                    <FileSpreadsheet className="w-3 h-3 mr-1" /> CSV Import
                  </span>
                  <span>{new Date(list.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
