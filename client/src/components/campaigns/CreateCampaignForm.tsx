import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/auth-context";

interface CreateCampaignFormProps {
  onSubmit: (formData: any) => void;
  templates: any[];
  selectedTemplate: any;
  setSelectedTemplate: (template: any) => void;
  variableMapping: Record<string, string>;
  setVariableMapping: (mapping: Record<string, string>) => void;
  extractTemplateVariables: (template: any) => string[];
  timeInterval: number;
  setTimeInterval: (interval: number) => void;
  isCreating: boolean;
  onCancel?: () => void;
  children: ReactNode;
}

export function CreateCampaignForm({
  onSubmit,
  templates,
  selectedTemplate,
  setSelectedTemplate,
  variableMapping,
  setVariableMapping,
  extractTemplateVariables,
  timeInterval,
  setTimeInterval,
  isCreating,
  onCancel,
  children
}: CreateCampaignFormProps) {
  // console.log(templates)
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const campaignData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      variableMapping: variableMapping,
      timeInterval: timeInterval,
    };
    onSubmit(campaignData);
  };


  const activeTemplates = Array.isArray(templates)
    ? templates.filter((t: any) => t.status?.toLowerCase() === "approved")
    : [];



  const { user } = useAuth()

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div>
        <Label htmlFor="name">Campaign Name</Label>
        <Input id="name" name="name" required placeholder="Name" />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" placeholder="Campaign objectives and notes..." />
      </div>

      <div>
        <Label>Template</Label>
        <Select value={selectedTemplate?.id} onValueChange={(value) => {
          const template = templates.find(t => t.id === value);
          setSelectedTemplate(template);
          setVariableMapping({});
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Select a template" />
          </SelectTrigger>
          <SelectContent>
            {/* {templates.map((template: any) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name} ({template.language})
              </SelectItem>
            ))} */}

            {activeTemplates.map((template: any) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name} ({template.language})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Show template preview */}
      {selectedTemplate && (
        <div className="bg-gray-50 p-4 rounded-md space-y-2">
          <Label>Template Preview</Label>
          {selectedTemplate.headerType === "text" && selectedTemplate.headerText && (
            <div className="font-semibold">{selectedTemplate.headerText}</div>
          )}
          <div className="whitespace-pre-wrap">{selectedTemplate.body}</div>
          {selectedTemplate.footerText && (
            <div className="text-sm text-gray-600">{selectedTemplate.footerText}</div>
          )}
        </div>
      )}

      {/* Variable mapping */}
      {selectedTemplate && extractTemplateVariables(selectedTemplate).length > 0 && (
        <div className="space-y-2">
          <Label>Template Variables</Label>
          {extractTemplateVariables(selectedTemplate).map((variable: string) => (
            <div key={variable}>
              <Label htmlFor={`var-${variable}`} className="text-sm font-normal">
                Variable {variable}
              </Label>
              <Input
                id={`var-${variable}`}
                placeholder={`Value for {{${variable}}}`}
                value={variableMapping[variable] || ''}
                onChange={(e) => setVariableMapping({
                  ...variableMapping,
                  [variable]: e.target.value
                })}
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <Label htmlFor="timeInterval">Time Interval Between Messages (seconds)</Label>
        <Input
          id="timeInterval"
          type="number"
          min="1"
          max="300"
          value={timeInterval}
          onChange={(e) => setTimeInterval(Math.max(1, parseInt(e.target.value) || 1))}
          placeholder="e.g. 5 (seconds between each message)"
        />
        <p className="text-xs text-muted-foreground mt-1">Wait this many seconds between sending each message.</p>
      </div>

      {children}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={user?.username === 'demouser' ? true : isCreating}>
          Start Campaign
        </Button>
      </div>
    </form>
  );
}