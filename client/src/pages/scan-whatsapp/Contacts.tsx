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
  Check,
  Phone,
  ArrowLeft,
  X
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { Checkbox } from "@/components/ui/checkbox";

export default function ScanContacts() {
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [listName, setListName] = useState("");
  const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  
  // Contact Detail View State
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newManualNumber, setNewManualNumber] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contactLists, isLoading } = useQuery<any[]>({
    queryKey: ["/api/scan-contacts"],
  });

  // Derive the active list from the query data
  const selectedList = contactLists?.find(l => l.id === selectedListId);

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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      return await apiRequest("PATCH", `/api/scan-contacts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-contacts"] });
      setNewManualNumber("");
      setSelectedContacts(new Set());
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
      setSelectedListId(null);
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    Papa.parse(file, {
      complete: (results) => {
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

  const handleAddManualContact = () => {
    if (!selectedList) return;
    const clean = newManualNumber.replace(/\D/g, "");
    if (clean.length < 10 || clean.length > 15) {
      toast({ title: "Invalid Number", description: "Please enter a valid phone number", variant: "destructive" });
      return;
    }

    if (selectedList.phoneNumbers.includes(clean)) {
      toast({ title: "Exists", description: "This number is already in the list" });
      return;
    }

    updateMutation.mutate({
      id: selectedList.id,
      data: { phoneNumbers: [...selectedList.phoneNumbers, clean] }
    });
  };

  const handleRemoveContacts = () => {
    if (!selectedList || selectedContacts.size === 0) return;
    
    const remaining = selectedList.phoneNumbers.filter((n: string) => !selectedContacts.has(n));
    updateMutation.mutate({
      id: selectedList.id,
      data: { phoneNumbers: remaining }
    });
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts));
    }
  };

  const toggleContact = (number: string) => {
    const next = new Set(selectedContacts);
    if (next.has(number)) {
      next.delete(number);
    } else {
      next.add(number);
    }
    setSelectedContacts(next);
  };

  const filteredLists = contactLists?.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.ownerName && l.ownerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredContacts = selectedList?.phoneNumbers?.filter((n: string) => 
    n.includes(contactSearch)
  ) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {selectedList ? (
        // Detailed View for a Single Contact List
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedListId(null)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  {selectedList.name}
                  <Badge variant="secondary" className="ml-2 font-medium">
                    {selectedList.phoneNumbers?.length || 0} Contacts
                  </Badge>
                </h1>
                <p className="text-gray-500 text-sm">Manage individual contacts in this list.</p>
              </div>
            </div>
            
            {selectedContacts.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleRemoveContacts} disabled={updateMutation.isPending}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedContacts.size})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Add New Contact Column */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Add New Contact</CardTitle>
                <CardDescription>Manually add a single phone number.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Phone Number</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. 923001234567" 
                      value={newManualNumber}
                      onChange={(e) => setNewManualNumber(e.target.value)}
                    />
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 shrink-0"
                      onClick={handleAddManualContact}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* List View Column */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 pr-4 border-r">
                    <Checkbox 
                      checked={filteredContacts.length > 0 && selectedContacts.size === filteredContacts.length}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm font-medium">Select All</span>
                  </div>
                  <div>
                    <CardTitle className="text-lg">Contact List</CardTitle>
                    <CardDescription>Search and manage entries.</CardDescription>
                  </div>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    className="pl-9 h-9" 
                    placeholder="Search numbers..." 
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="divide-y border-t">
                    {filteredContacts?.map((number: string) => (
                      <div key={number} className="flex items-center justify-between p-4 hover:bg-gray-50 group">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={selectedContacts.has(number)}
                            onCheckedChange={() => toggleContact(number)}
                          />
                          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                            <Phone className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-gray-900">+{number}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            const next = new Set([number]);
                            setSelectedContacts(next);
                            handleRemoveContacts();
                          }}
                          disabled={updateMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {filteredContacts?.length === 0 && (
                      <div className="p-12 text-center text-gray-500">
                        No contacts match your search.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
              <DialogFooter className="p-4 bg-gray-50/50 border-t rounded-b-lg">
                <Button variant="destructive" onClick={() => deleteMutation.mutate(selectedList.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Entire List
                </Button>
              </DialogFooter>
            </Card>
          </div>
        </div>
      ) : (
        // Grid View of All Lists
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isSuper ? "Master Contacts" : "WhatsApp Contacts"}
              </h1>
              <p className="text-gray-500">
                {isSuper ? "Monitoring all contact lists uploaded by admins across the platform." : "Manage your contact lists for bulk messaging."}
              </p>
            </div>

            {!isSuper && (
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
            )}
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
                <Card 
                  key={list.id} 
                  className="hover:shadow-md transition-all group overflow-hidden border-l-4 border-l-blue-500 relative cursor-pointer"
                  onClick={() => setSelectedListId(list.id)}
                >
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
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(list.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-4 border-t border-gray-50 bg-gray-50/30">
                    {isSuper && (
                      <div className="mb-3">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 font-normal border-blue-100">
                          Owner: {list.ownerName || "Unknown"}
                        </Badge>
                      </div>
                    )}
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
        </>
      )}
    </div>
  );
}
