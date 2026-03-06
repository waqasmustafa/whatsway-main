import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Loading } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  Ban,
  Archive,
  Trash2,
  Star,
  Filter,
  MessageCircle,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  Smile,
  Mic,
  Image,
  X,
  Users,
  UserPlus,
  User as UserIcon,
  ChevronDown,
  Calendar,
  Tag,
  Forward,
  Reply,
  Download,
  Volume2,
  Bot,
} from "lucide-react";
import { api } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  isToday,
  isYesterday,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { Conversation, Contact, User } from "@shared/schema";
import { useAuth } from "@/contexts/auth-context";
import { io, Socket } from "socket.io-client";
import { useTranslation } from "@/lib/i18n";

// Helper functions
const formatLastSeen = (date: Date | string | null) => {
  if (!date) return "Never";

  const lastSeenDate = new Date(date);
  const now = new Date();
  const minutes = differenceInMinutes(now, lastSeenDate);
  const hours = differenceInHours(now, lastSeenDate);
  const days = differenceInDays(now, lastSeenDate);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return format(lastSeenDate, "MMM d, yyyy");
};

const formatMessageDate = (date: Date | string) => {
  const messageDate = new Date(date);

  if (isToday(messageDate)) return "Today";
  if (isYesterday(messageDate)) return "Yesterday";
  return format(messageDate, "MMMM d, yyyy");
};

const getMessageStatusIcon = (status: string) => {
  switch (status) {
    case "sent":
      return <Check className="w-3 h-3 text-gray-400" />;
    case "delivered":
      return <CheckCheck className="w-3 h-3 text-gray-400" />;
    case "read":
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    default:
      return <Clock className="w-3 h-3 text-gray-400" />;
  }
};

// Conversation List Item Component
const ConversationListItem = ({
  conversation,
  isSelected,
  onClick,
  user,
  isCheckMode,
  isChecked,
  onCheck,
}: {
  conversation: Conversation & { contact?: Contact };
  isSelected: boolean;
  onClick: () => void;
  user?: any;
  isCheckMode?: boolean;
  isChecked?: boolean;
  onCheck?: (checked: boolean) => void;
}) => {
  const lastMessageTime = conversation.lastMessageAt
    ? formatLastSeen(conversation.lastMessageAt)
    : "";

  function getMessagePreview(message: string | null | undefined): string {
    if (!message) return "";
    return message.length <= 40 ? message : message.substring(0, 40) + "...";
  }

  return (
    <div
      onClick={isCheckMode ? undefined : onClick}
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer transition-colors border-b",
        isSelected && !isCheckMode
          ? "bg-green-50 border-l-4 border-l-green-600"
          : "hover:bg-gray-50",
        isChecked ? "bg-red-50" : ""
      )}
    >
      {isCheckMode ? (
        <input
          type="checkbox"
          checked={isChecked ?? false}
          onChange={(e) => { e.stopPropagation(); onCheck?.(e.target.checked); }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer flex-shrink-0"
        />
      ) : (
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-gray-200">
            {conversation.contactName?.[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="flex-1 min-w-0" onClick={isCheckMode ? onClick : undefined}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-medium text-gray-900 truncate">
            {user?.username === "demouser"
              ? conversation.contactName
                ? conversation.contactName.slice(0, -1).replace(/./g, "*") +
                conversation.contactName.slice(-1)
                : conversation.contactPhone
                  ? conversation.contactPhone.slice(0, -4).replace(/\d/g, "*") +
                  conversation.contactPhone.slice(-4)
                  : "Unknown"
              : conversation.contactName ||
              conversation.contactPhone ||
              "Unknown"}
          </h4>
          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
            {lastMessageTime}
          </span>
        </div>

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center min-w-0">
            {conversation.type === "whatsapp" && (
              <MessageCircle className="w-4 h-4 text-green-600 inline-block mr-1 flex-shrink-0" />
            )}
            {conversation.type === "messenger" && (
              <MessageCircle className="w-4 h-4 text-blue-600 inline-block mr-1 flex-shrink-0" />
            )}
            {conversation.type === "chatbot" && (
              <Bot className="w-4 h-4 text-green-600 inline-block mr-1 flex-shrink-0" />
            )}
            <p className="text-sm text-gray-600 truncate">
              {getMessagePreview(conversation.lastMessageText) ||
                "No messages yet"}
            </p>
          </div>

          {conversation.unreadCount && conversation.unreadCount > 0 && (
            <Badge className="ml-2 bg-green-600 text-white">
              {conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

interface Message {
  id: string;
  conversationId: string;
  whatsappMessageId?: string;
  fromUser: boolean;
  direction: string;
  content: string;
  type: string;
  messageType: string;
  mediaId?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  status?: string;
  metadata?: {
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
    originalName?: string;
  };
  createdAt: string;
}

const MessageItem = ({
  message,
  showDate,
}: {
  message: Message;
  showDate: boolean;
}) => {
  const isOutbound = message.direction === "outbound";

  const renderMediaContent = () => {
    // Check if message has media content
    const hasMedia = message.mediaId || message.mediaUrl;
    const messageType = message.messageType || message.type;

    // Use backend proxy for Facebook/WhatsApp URLs, direct URL for others
    const needsProxy =
      hasMedia &&
      message.mediaUrl &&
      message.mediaUrl.includes("lookaside.fbsbx.com");
    const mediaUrl = hasMedia
      ? needsProxy
        ? `/api/messages/media-proxy?messageId=${message.id}`
        : message.mediaUrl
      : null;
    const downloadUrl = hasMedia
      ? needsProxy
        ? `/api/messages/media-proxy?messageId=${message.id}&download=true`
        : message.mediaUrl
      : null;

    // Helper function to render text content
    const renderTextContent = () => {
      if (
        !message.content ||
        message.content === "[image]" ||
        message.content === "[video]" ||
        message.content === "[audio]" ||
        message.content === "[document]"
      ) {
        return null;
      }
      return <p className="text-sm whitespace-pre-wrap">{message.content}</p>;
    };

    // Handle different message types
    switch (messageType) {
      case "image":
        return (
          <div className="space-y-2">
            {hasMedia && (
              <div className="relative group">
                <button
                  onClick={() => mediaUrl && window.open(mediaUrl, "_blank")}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      mediaUrl && window.open(mediaUrl, "_blank");
                    }
                  }}
                  className="max-w-[250px] max-h-[300px] rounded-lg object-cover cursor-pointer transition-opacity group-hover:opacity-90"
                  style={{ background: "none", border: "none", padding: 0 }}
                >
                  <img
                    src={mediaUrl || ""}
                    alt=""
                    className="max-w-[250px] max-h-[300px] rounded-lg object-cover"
                    onError={(e) => {
                      console.error("Failed to load image:", mediaUrl);
                      e.currentTarget.src =
                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+";
                    }}
                  />
                </button>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black bg-opacity-50 rounded-full p-2">
                    <Image className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            )}
            {renderTextContent()}
          </div>
        );

      case "video":
        return (
          <div className="space-y-2">
            {hasMedia && (
              <div className="relative">
                <video
                  controls
                  className="max-w-[250px] max-h-[300px] rounded-lg"
                  preload="metadata"
                  onError={(e) => {
                    console.error("Failed to load video:", mediaUrl);
                  }}
                >
                  <source
                    src={`${mediaUrl}#t=0.1`}
                    type={message.mediaMimeType}
                  />
                  Your browser does not support the video tag.
                </video>
                <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1">
                  <Video className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
            {renderTextContent()}
          </div>
        );

      case "audio":
        return (
          <div className="space-y-2">
            {hasMedia && (
              <div
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg min-w-[200px]",
                  isOutbound ? "bg-green-700" : "bg-gray-200"
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-full",
                    isOutbound ? "bg-green-800" : "bg-gray-300"
                  )}
                >
                  <Volume2
                    className={cn(
                      "w-4 h-4",
                      isOutbound ? "text-white" : "text-gray-600"
                    )}
                  />
                </div>
                <div className="flex-1">
                  <audio
                    controls
                    className="w-full h-8"
                    style={{
                      filter: isOutbound ? "invert(1)" : "none",
                    }}
                    onError={(e) => {
                      console.error("Failed to load audio:", mediaUrl);
                    }}
                  >
                    <source src={mediaUrl || ""} type={message.mediaMimeType} />
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              </div>
            )}
            {renderTextContent()}
          </div>
        );

      case "document":
        const fileName =
          message.metadata?.originalName ||
          (
            message.metadata as {
              filePath?: string;
              fileSize?: number;
              mimeType?: string;
              originalName?: string;
              fileName?: string;
            }
          ).fileName ||
          "Document";
        const fileSize = message.metadata?.fileSize
          ? `${Math.round(message.metadata.fileSize / 1024)} KB`
          : "";

        return (
          <div className="space-y-2">
            {hasMedia && (
              <div
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg border",
                  isOutbound
                    ? "bg-green-700 border-green-600"
                    : "bg-white border-gray-200"
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-full",
                    isOutbound ? "bg-green-800" : "bg-blue-100"
                  )}
                >
                  <FileText
                    className={cn(
                      "w-5 h-5",
                      isOutbound ? "text-white" : "text-blue-600"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium truncate",
                      isOutbound ? "text-white" : "text-gray-900"
                    )}
                  >
                    {fileName}
                  </p>
                  <div className="flex items-center space-x-2">
                    {fileSize && (
                      <p
                        className={cn(
                          "text-xs",
                          isOutbound ? "text-green-100" : "text-gray-500"
                        )}
                      >
                        {fileSize}
                      </p>
                    )}
                    {(message.mediaMimeType || message.metadata?.mimeType) && (
                      <p
                        className={cn(
                          "text-xs",
                          isOutbound ? "text-green-100" : "text-gray-500"
                        )}
                      >
                        {(
                          message.mediaMimeType ??
                          message.metadata?.mimeType ??
                          "FILE/UNKNOWN"
                        )
                          .split("/")[1]
                          ?.toUpperCase() || "FILE"}
                      </p>
                    )}
                  </div>
                </div>
                <a
                  href={downloadUrl || ""}
                  download={fileName}
                  className={cn(
                    "p-1 rounded-full hover:bg-opacity-80 transition-colors",
                    isOutbound ? "hover:bg-green-800" : "hover:bg-gray-100"
                  )}
                  onClick={(e) => e.stopPropagation()}
                  title="Download file"
                >
                  <Download
                    className={cn(
                      "w-4 h-4",
                      isOutbound ? "text-white" : "text-gray-600"
                    )}
                  />
                </a>
              </div>
            )}
            {renderTextContent()}
          </div>
        );

      case "interactive":
        // Handle interactive messages (buttons/lists)
        interface MessageMetadata {
          filePath?: string;
          fileSize?: number;
          mimeType?: string;
          originalName?: string;
          buttons?: { id?: string; text: string }[]; // Add buttons property
        }

        const buttons = (message.metadata as MessageMetadata)?.buttons;
        return (
          <div className="space-y-3">
            {renderTextContent()}
            {buttons && buttons.length > 0 && (
              <div className="space-y-2">
                {buttons.map(
                  (button: { id?: string; text: string }, index: number) => (
                    <button
                      key={button.id || index}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors",
                        isOutbound
                          ? "border-green-300 text-green-100 hover:bg-green-700"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      )}
                      onClick={() => {
                        // Handle button click - you might want to emit an event or call a callback
                        console.log("Button clicked:", button);
                      }}
                    >
                      {button.text}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        );

      case "template":
        return (
          <div
            className={cn(
              "flex items-start space-x-2 p-3 rounded border-l-4",
              isOutbound
                ? "border-green-300 bg-green-700"
                : "border-blue-400 bg-blue-50"
            )}
          >
            <div className="text-lg mt-1">📧</div>
            <div className="flex-1">
              <p
                className={cn(
                  "text-xs font-medium mb-1",
                  isOutbound ? "text-green-100" : "text-blue-700"
                )}
              >
                Template Message
              </p>
              {renderTextContent()}
            </div>
          </div>
        );

      case "text":
      default:
        // Handle text messages that might also have media
        if (hasMedia) {
          // Determine media type from MIME type or URL
          const mimeType =
            message.mediaMimeType || message.metadata?.mimeType || "";
          const isImage =
            mimeType.startsWith("image/") ||
            mediaUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
          const isVideo =
            mimeType.startsWith("video/") ||
            mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);
          const isAudio =
            mimeType.startsWith("audio/") ||
            mediaUrl?.match(/\.(mp3|wav|ogg|m4a)$/i);

          if (isImage) {
            return (
              <div className="space-y-2">
                <div className="relative group">
                  <button
                    onClick={() => mediaUrl && window.open(mediaUrl, "_blank")} // Ensure mediaUrl is a valid string
                    className="max-w-[250px] max-h-[300px] rounded-lg object-cover cursor-pointer transition-opacity group-hover:opacity-90"
                    onError={(e) => {
                      console.error("Failed to load image:", mediaUrl);
                      // e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
                    }}
                    onKeyDown={(e) => {
                      // Add keyboard event listener for accessibility
                      if (e.key === "Enter" || e.key === " ") {
                        mediaUrl && window.open(mediaUrl, "_blank"); // Ensure mediaUrl is a valid string
                      }
                    }}
                    tabIndex={0} // Make the button focusable
                  >
                    <img
                      src={mediaUrl || ""} // Ensure src is a string
                      alt="" // Remove redundant words from alt attribute
                    />
                  </button>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black bg-opacity-50 rounded-full p-2">
                      <Image className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                {renderTextContent()}
              </div>
            );
          } else if (isVideo) {
            return (
              <div className="space-y-2">
                <div className="relative">
                  <video
                    controls
                    className="max-w-[250px] max-h-[300px] rounded-lg"
                    preload="metadata"
                    onError={(e) => {
                      console.error("Failed to load video:", mediaUrl);
                    }}
                  >
                    <source src={`${mediaUrl}#t=0.1`} type={mimeType} />
                    Your browser does not support the video tag.
                  </video>
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1">
                    <Video className="w-4 h-4 text-white" />
                  </div>
                </div>
                {renderTextContent()}
              </div>
            );
          } else if (isAudio) {
            return (
              <div className="space-y-2">
                <div
                  className={cn(
                    "flex items-center space-x-3 p-3 rounded-lg min-w-[200px]",
                    isOutbound ? "bg-green-700" : "bg-gray-200"
                  )}
                >
                  <div
                    className={cn(
                      "p-2 rounded-full",
                      isOutbound ? "bg-green-800" : "bg-gray-300"
                    )}
                  >
                    <Volume2
                      className={cn(
                        "w-4 h-4",
                        isOutbound ? "text-white" : "text-gray-600"
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <audio
                      controls
                      className="w-full h-8"
                      style={{
                        filter: isOutbound ? "invert(1)" : "none",
                      }}
                      onError={(e) => {
                        console.error("Failed to load audio:", mediaUrl);
                      }}
                    >
                      <source src={mediaUrl || ""} type={mimeType || ""} />
                      Your browser does not support the audio tag.
                    </audio>
                  </div>
                </div>
                {renderTextContent()}
              </div>
            );
          } else {
            // Generic file/document
            const fileName =
              message.metadata?.originalName ||
              message.metadata?.originalName ||
              "Attachment";
            const fileSize = message.metadata?.fileSize
              ? `${Math.round(message.metadata.fileSize / 1024)} KB`
              : "";

            return (
              <div className="space-y-2">
                <div
                  className={cn(
                    "flex items-center space-x-3 p-3 rounded-lg border",
                    isOutbound
                      ? "bg-green-700 border-green-600"
                      : "bg-white border-gray-200"
                  )}
                >
                  <div
                    className={cn(
                      "p-2 rounded-full",
                      isOutbound ? "bg-green-800" : "bg-blue-100"
                    )}
                  >
                    <FileText
                      className={cn(
                        "w-5 h-5",
                        isOutbound ? "text-white" : "text-blue-600"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        isOutbound ? "text-white" : "text-gray-900"
                      )}
                    >
                      {fileName}
                    </p>
                    <div className="flex items-center space-x-2">
                      {fileSize && (
                        <p
                          className={cn(
                            "text-xs",
                            isOutbound ? "text-green-100" : "text-gray-500"
                          )}
                        >
                          {fileSize}
                        </p>
                      )}
                      {mimeType && (
                        <p
                          className={cn(
                            "text-xs",
                            isOutbound ? "text-green-100" : "text-gray-500"
                          )}
                        >
                          {mimeType.split("/")[1]?.toUpperCase() || "FILE"}
                        </p>
                      )}
                    </div>
                  </div>
                  <a
                    href={downloadUrl || undefined}
                    download={fileName}
                    className={cn(
                      "p-1 rounded-full hover:bg-opacity-80 transition-colors",
                      isOutbound ? "hover:bg-green-800" : "hover:bg-gray-100"
                    )}
                    onClick={(e) => e.stopPropagation()}
                    title="Download file"
                  >
                    <Download
                      className={cn(
                        "w-4 h-4",
                        isOutbound ? "text-white" : "text-gray-600"
                      )}
                    />
                  </a>
                </div>
                {renderTextContent()}
              </div>
            );
          }
        }

        // Pure text message
        return (
          renderTextContent() || (
            <p className="text-sm whitespace-pre-wrap">
              {message.content || ""}
            </p>
          )
        );
    }
  };

  const formatMessageDate = (date: string | Date) => {
    return format(new Date(date), "MMMM d, yyyy");
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <span className="text-xs">✓</span>;
      case "delivered":
        return <span className="text-xs">✓✓</span>;
      case "read":
        return <span className="text-xs text-blue-300">✓✓</span>;
      case "failed":
        return <span className="text-xs text-red-300">✗</span>;
      default:
        return <span className="text-xs">○</span>;
    }
  };

  return (
    <>
      {showDate && (
        <div className="flex items-center justify-center my-4">
          <div className="bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600">
            {formatMessageDate(message.createdAt)}
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex items-end gap-2 mb-4",
          isOutbound ? "justify-end" : "justify-start"
        )}
      >
        {!isOutbound && (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gray-200 text-xs">C</AvatarFallback>
          </Avatar>
        )}

        <div
          className={cn(
            "max-w-[70%] rounded-2xl px-4 py-2",
            isOutbound
              ? "bg-green-600 text-white rounded-br-sm"
              : "bg-gray-100 text-gray-900 rounded-bl-sm"
          )}
        >
          {renderMediaContent()}

          <div
            className={cn(
              "flex items-center gap-1 mt-2",
              isOutbound ? "justify-end" : "justify-start"
            )}
          >
            <span
              className={cn(
                "text-xs",
                isOutbound ? "text-green-100" : "text-gray-500"
              )}
            >
              {format(new Date(message.createdAt), "h:mm a")}
            </span>
            {isOutbound && getMessageStatusIcon(message.status || "pending")}
          </div>
        </div>
      </div>
    </>
  );
};

// Template Dialog Component
const TemplateDialog = ({
  channelId,
  onSelectTemplate,
}: {
  channelId?: string;
  onSelectTemplate: (template: any) => void;
}) => {
  const [open, setOpen] = useState(false);
  const { data: templates = [], isLoading: templatesLoading, refetch } = useQuery({
    queryKey: ["/api/templates", channelId],
    queryFn: async () => {
      const response = await api.getTemplates(channelId);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!channelId,
    staleTime: 0,
  });

  // Force fresh fetch every time dialog opens
  useEffect(() => {
    if (open && channelId) {
      refetch();
    }
  }, [open, channelId]);

  const approvedTemplates = templates.filter(
    (t: any) => t.status === "APPROVED"
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <FileText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Template</DialogTitle>
          <DialogDescription>
            Choose from approved WhatsApp templates
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loading />
            </div>
          ) : approvedTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No approved templates available
            </div>
          ) : (
            <div className="space-y-3">
              {approvedTemplates.map((template: any) => (
                <div
                  key={template.id}
                  onClick={() => {
                    onSelectTemplate(template);
                    setOpen(false);
                  }}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{template.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{template.body}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// Team Assignment Dropdown Component
const TeamAssignDropdown = ({
  conversationId,
  currentAssignee,
  currentAssigneeName,
  onAssign,
}: {
  conversationId: string;
  currentAssignee?: string;
  currentAssigneeName?: string;
  onAssign: (assignedTo: string, assignedToName: string) => void;
}) => {
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // console.log(currentAssignee , currentAssigneeName)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          {currentAssignee ? `Reassign (${currentAssigneeName})` : "Assign"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Assign to team member</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {currentAssignee && (
          <>
            <DropdownMenuItem onClick={() => onAssign("", "")}>
              <UserIcon className="w-4 h-4 mr-2" />
              Unassign
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {users?.map((user: any) => (
          <DropdownMenuItem
            key={user.id}
            onClick={() =>
              onAssign(
                user.id,
                `${user.firstName} ${user.lastName}`.trim() || user.username
              )
            }
          >
            <UserIcon className="w-4 h-4 mr-2" />
            <div className="flex flex-col">
              <span>
                {user.firstName} {user.lastName}
              </span>
              <span className="text-xs text-gray-500">@{user.username}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Main Component
export default function Inbox() {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Select & delete state
  const [isCheckMode, setIsCheckMode] = useState(false);
  const [selectedConvoIds, setSelectedConvoIds] = useState<string[]>([]);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/conversations/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConvoIds([]);
      setIsCheckMode(false);
      if (selectedConversation && selectedConvoIds.includes(selectedConversation.id)) {
        setSelectedConversation(null);
      }
      toast({ title: "Deleted", description: "Selected chats deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete chats.", variant: "destructive" });
    },
  });

  const handleToggleCheckMode = () => {
    setIsCheckMode((prev) => !prev);
    setSelectedConvoIds([]);
  };

  const { t } = useTranslation();

  // Socket.io state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string>("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch active channel
  const { data: activeChannel } = useQuery({
    queryKey: ["/api/channels/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/channels/active");
      if (!response.ok) return null;
      return await response.json();
    },
  });

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } =
    useQuery({
      queryKey: ["/api/conversations", activeChannel?.id],
      queryFn: async () => {
        const response = await api.getConversations(activeChannel?.id);
        return await response.json();
      },
      enabled: !!activeChannel,
      refetchInterval: 5000, // Poll every 5 seconds for live updates
      staleTime: 0,
    });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
    queryFn: async () => {
      if (!selectedConversation?.id) return [];
      const response = await api.getMessages(selectedConversation.id);
      const data = await response.json();
      // After messages are loaded, invalidate conversations so unread badge clears
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      return data;
    },
    enabled: !!selectedConversation?.id,
    staleTime: 0,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize Socket.io connection for real-time chat
  useEffect(() => {
    if (!user?.id) return;

    const API_BASE = `${window.location.origin}`;
    console.log("Connecting to Socket.io at", API_BASE);
    const socketInstance = io(API_BASE, {
      query: {
        userId: user.id,
        role: user.role || "agent",
        siteId: activeChannel?.id || "default",
      },
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("Socket.io connected for agent");
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket.io disconnected");
    });

    // Listen for new messages (from visitors or AI)
    socketInstance.on("new_message", (data) => {
      console.log("New message received:", data);

      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      // If message is for selected conversation, refresh messages
      if (
        selectedConversation &&
        data.conversationId === selectedConversation.id
      ) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", selectedConversation.id, "messages"],
        });
      }
    });

    // Listen for visitor typing
    socketInstance.on("user_typing", (data) => {
      if (selectedConversation?.id === data.conversationId) {
        setIsTyping(true);
        setTypingUser("Visitor");
      }
    });

    socketInstance.on("user_stopped_typing", (data) => {
      if (selectedConversation?.id === data.conversationId) {
        setIsTyping(false);
        setTypingUser("");
      }
    });

    // New conversation assigned to this agent
    socketInstance.on("new_conversation_assigned", (data) => {
      if (data.agentId === user.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        toast({
          title: "New Conversation Assigned",
          description: "A new conversation has been assigned to you",
        });
      }
    });

    // Conversation transferred
    socketInstance.on("conversation_transferred", (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (selectedConversation?.id === data.conversationId) {
        toast({
          title: "Conversation Transferred",
          description: `Transferred to ${data.agent?.name || "another agent"}`,
        });
      }
    });

    // Messages marked as read
    socketInstance.on("messages_read", (data) => {
      if (selectedConversation?.id === data.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", selectedConversation.id, "messages"],
        });
      }
    });

    // Message status updates
    socketInstance.on("message_status_update", (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
      });
    });

    // Conversation status changed
    socketInstance.on("conversation_status_changed", (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (selectedConversation?.id === data.conversationId) {
        toast({
          title: "Conversation Status Changed",
          description: `Status changed to: ${data.status}`,
        });
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.id, activeChannel?.id]);

  // WebSocket connection for WhatsApp (keep existing)
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected (WhatsApp)");
      ws.send(JSON.stringify({ type: "join-all-conversations" }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "new-message") {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

        if (
          selectedConversation &&
          data.conversationId === selectedConversation.id
        ) {
          queryClient.invalidateQueries({
            queryKey: [
              "/api/conversations",
              selectedConversation.id,
              "messages",
            ],
          });
        }
      }
    };

    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = () => console.log("WebSocket disconnected");

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);





  // Join conversation room when selected
  useEffect(() => {
    if (!selectedConversation || !socket) return;

    // Join the conversation room via Socket.io
    socket.emit("agent_join_conversation", {
      conversationId: selectedConversation.id,
      agentId: user?.id,
      agentName:
        `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
        user?.username,
    });

    // Join via WebSocket for WhatsApp
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "join-conversation",
          conversationId: selectedConversation.id,
        })
      );
    }
  }, [selectedConversation, socket]);

  // Send message mutation (updated for Socket.io)
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; content: string }) => {
      const response = await fetch(
        `/api/conversations/${data.conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: data.content,
            fromUser: true,
            fromType: "agent",
            agentId: user?.id,
            agentName:
              `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
              user?.username,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send message");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Emit via Socket.io for real-time delivery
      if (socket && selectedConversation) {
        socket.emit("agent_send_message", {
          conversationId: selectedConversation.id,
          content: messageText,
          agentId: user?.id,
          agentName:
            `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
            user?.username,
        });
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      setMessageText("");

      // Stop typing indicator
      if (socket && selectedConversation) {
        socket.emit("agent_stopped_typing", {
          conversationId: selectedConversation.id,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle typing indicator
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);

    if (!socket || !selectedConversation) return;

    // Send typing indicator via Socket.io
    socket.emit("agent_typing", {
      conversationId: selectedConversation.id,
      agentName:
        `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
        user?.username,
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("agent_stopped_typing", {
        conversationId: selectedConversation.id,
      });
    }, 2000);
  };

  // Update conversation status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { conversationId: string; status: string }) => {
      const response = await fetch(
        `/api/conversations/${data.conversationId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: data.status }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update status");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Emit status change via Socket.io
      if (socket) {
        socket.emit("conversation_status_changed", {
          conversationId: variables.conversationId,
          status: variables.status,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Success",
        description: "Conversation status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send template mutation
  const sendTemplateMutation = useMutation({
    mutationFn: async (data: {
      conversationId: string;
      templateName: string;
      phoneNumber: string;
    }) => {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: data.phoneNumber,
          templateName: data.templateName,
          channelId: selectedConversation?.channelId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
      });
      toast({
        title: "Success",
        description: "Template sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversation) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      content: messageText.trim(),
    });
  };

  const handleSelectTemplate = (template: any) => {
    if (!selectedConversation) return;

    sendTemplateMutation.mutate({
      conversationId: selectedConversation.id,
      templateName: template.name,
      phoneNumber: selectedConversation.contactPhone || "",
    });
  };

  const handleFileAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversation) return;

    const formData = new FormData();
    formData.append("media", file);
    formData.append("fromUser", "true");
    formData.append("conversationId", selectedConversation.id);
    formData.append("caption", messageText || "");

    try {
      const response = await fetch(
        `/api/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send media");
      }

      toast({
        title: "Success",
        description: "Media sent successfully",
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation.id, "messages"],
      });
      setMessageText("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }

    event.target.value = "";
  };

  const updateConversationStatus = (status: string) => {
    if (!selectedConversation) return;

    updateStatusMutation.mutate({
      conversationId: selectedConversation.id,
      status: status,
    });
  };

  const handleViewContact = () => {
    if (!selectedConversation || !selectedConversation.contactId) return;
    window.location.href = `/contacts?id=${selectedConversation.contactId
      }&phone=${selectedConversation.contactPhone || ""}`;
  };

  const handleArchiveChat = async () => {
    if (!selectedConversation) return;

    try {
      await apiRequest(
        "PATCH",
        `/api/conversations/${selectedConversation.id}`,
        { status: "archived" }
      );

      toast({
        title: "Chat Archived",
        description: "This conversation has been archived",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConversation(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to archive chat",
        variant: "destructive",
      });
    }
  };

  const handleBlockContact = async () => {
    if (!selectedConversation || !selectedConversation.contactId) return;

    try {
      await apiRequest(
        "PATCH",
        `/api/contacts/${selectedConversation.contactId}`,
        { status: "blocked" }
      );

      toast({
        title: "Contact Blocked",
        description: "This contact has been blocked",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to block contact",
        variant: "destructive",
      });
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedConversation) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this chat? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      await apiRequest(
        "DELETE",
        `/api/conversations/${selectedConversation.id}`
      );

      toast({
        title: "Chat Deleted",
        description: "This conversation has been deleted",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConversation(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete chat",
        variant: "destructive",
      });
    }
  };

  const updateConversationMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const response = await fetch(`/api/conversations/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.updates),
      });
      const result = await response.json();

      if (!response.ok) {
        console.error(result.error || "Unknown error");
        throw new Error(result.error || "Failed to update conversation");
      }

      return result;
    },
    onSuccess: (updatedConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConversation(updatedConversation);
      toast({
        title: "Success",
        description: "Conversation updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssignConversation = (
    assignedTo: string,
    assignedToName: string
  ) => {
    if (!selectedConversation) return;

    updateConversationMutation.mutate({
      id: selectedConversation.id,
      updates: {
        assignedTo,
        assignedToName,
        assignedAt: new Date().toISOString(),
        status: assignedTo ? "assigned" : "open",
      },
    });
  };

  const handleCloseConversation = () => {
    if (!socket || !selectedConversation) return;

    socket.emit("close_conversation", {
      conversationId: selectedConversation.id,
      agentId: user?.id,
    });

    updateConversationStatus("closed");
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv: any) => {
    const matchesSearch =
      conv.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.contactPhone?.includes(searchQuery) ||
      conv.contactName?.toLowerCase().includes(searchQuery.toLowerCase());

    switch (filterTab) {
      case "unread":
        return matchesSearch && (conv.unreadCount || 0) > 0;
      case "open":
        return matchesSearch && conv.status === "open";
      case "resolved":
        return matchesSearch && conv.status === "resolved";
      case "whatsapp":
        return matchesSearch && conv.type === "whatsapp";
      case "chatbot":
        return matchesSearch && conv.type === "chatbot";
      case "assigned":
        return (
          matchesSearch &&
          conv.status === "assigned" &&
          (user?.role === "admin" || conv.assignedTo === user?.id)
        );
      default:
        return matchesSearch;
    }
  });

  // Check if 24-hour window has passed (for WhatsApp)
  const is24HourWindowExpired =
    selectedConversation?.lastMessageAt &&
      selectedConversation?.type === "whatsapp"
      ? differenceInHours(
        new Date(),
        new Date(selectedConversation.lastMessageAt)
      ) > 24
      : false;

  if (!activeChannel) {
    return (
      <div className="h-screen flex flex-col">
        <Header title={t("inbox.title")} />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={MessageCircle}
            title="No Active Channel"
            description="Please select a channel from the channel switcher to view conversations."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Header title={t("inbox.title")} />
      <div className="flex-1 flex bg-gray-50 overflow-hidden">
        {/* Conversations List */}
        <div
          className={cn(
            "bg-white border-r border-gray-200 flex flex-col",
            selectedConversation
              ? "hidden md:flex md:w-80 lg:w-96"
              : "w-full x-5 md:w-80 lg:w-96"
          )}
        >
          {/* Search and Filter */}
          <div className="p-2 sm:p-3 md:p-4 border-b border-gray-200 bg-white">
            {/* Search Input */}
            <div className="relative mb-2 sm:mb-3">

              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 sm:pl-9 pr-2 sm:pr-3 bg-gray-50 text-xs sm:text-sm w-full h-8 sm:h-10 rounded-lg"
              />
            </div>

            {/* Select All + Delete toolbar */}
            {isCheckMode ? (
              <div className="flex items-center gap-2 my-2 py-1 px-1 bg-red-50 rounded-md border border-red-200">
                <input
                  type="checkbox"
                  checked={selectedConvoIds.length === filteredConversations.length && filteredConversations.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedConvoIds(filteredConversations.map((c: any) => c.id));
                    } else {
                      setSelectedConvoIds([]);
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                />
                <span className="text-sm text-gray-700 flex-1">
                  {selectedConvoIds.length > 0 ? `${selectedConvoIds.length} selected` : "Select All"}
                </span>
                <button
                  onClick={() => {
                    if (selectedConvoIds.length > 0 && confirm(`Delete ${selectedConvoIds.length} chat(s)?`)) {
                      bulkDeleteMutation.mutate(selectedConvoIds);
                    }
                  }}
                  disabled={selectedConvoIds.length === 0 || bulkDeleteMutation.isPending}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={handleToggleCheckMode}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex justify-end my-2">
                <button
                  onClick={handleToggleCheckMode}
                  className="text-xs text-gray-500 hover:text-red-600 underline px-1"
                >
                  Select Chats
                </button>
              </div>
            )}

            {/* Tabs - Ultra Responsive */}

            <Tabs value={filterTab} onValueChange={setFilterTab}>
              <div className="overflow-x-auto -mx-2 sm:-mx-3 md:-mx-4 px-2 sm:px-3 md:px-4 [&::-webkit-scrollbar]:h-[2px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                <TabsList className="inline-flex w-auto h-7 sm:h-9 md:h-10 gap-1 sm:gap-1.5 md:gap-2 bg-gray-100 p-0.5 sm:p-1 rounded-lg">
                  <TabsTrigger
                    value="all"
                    className="text-[11px] sm:text-xs md:text-sm whitespace-nowrap px-2 sm:px-3 md:px-4 h-full rounded-md"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="whatsapp"
                    className="text-[11px] sm:text-xs md:text-sm whitespace-nowrap px-2 sm:px-3 md:px-4 h-full rounded-md"
                  >
                    WA
                  </TabsTrigger>
                  <TabsTrigger
                    value="chatbot"
                    className="text-[11px] sm:text-xs md:text-sm whitespace-nowrap px-2 sm:px-3 md:px-4 h-full rounded-md"
                  >
                    Widget
                  </TabsTrigger>
                  <TabsTrigger
                    value="assigned"
                    className="text-[11px] sm:text-xs md:text-sm whitespace-nowrap px-2 sm:px-3 md:px-4 h-full rounded-md"
                  >
                    Assigned
                  </TabsTrigger>
                  <TabsTrigger
                    value="unread"
                    className="text-[11px] sm:text-xs md:text-sm whitespace-nowrap px-2 sm:px-3 md:px-4 h-full rounded-md"
                  >
                    Unread
                  </TabsTrigger>
                  <TabsTrigger
                    value="open"
                    className="text-[11px] sm:text-xs md:text-sm whitespace-nowrap px-2 sm:px-3 md:px-4 h-full rounded-md"
                  >
                    Open
                  </TabsTrigger>
                  <TabsTrigger
                    value="resolved"
                    className="text-[11px] sm:text-xs md:text-sm whitespace-nowrap px-2 sm:px-3 md:px-4 h-full rounded-md"
                  >
                    Resolved
                  </TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          </div>

          {/* Conversations */}
          <ScrollArea className="flex-1 ">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loading />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No conversations found
              </div>
            ) : (
              filteredConversations.map(
                (conversation: Conversation & { contact?: Contact }) => (
                  <ConversationListItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversation?.id === conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    user={user}
                    isCheckMode={isCheckMode}
                    isChecked={selectedConvoIds.includes(conversation.id)}
                    onCheck={(checked) => {
                      setSelectedConvoIds((prev) =>
                        checked ? [...prev, conversation.id] : prev.filter((id) => id !== conversation.id)
                      );
                    }}
                  />
                )
              )
            )}
          </ScrollArea>
        </div>

        {/* Chat Area - Updated with typing indicator */}
        {selectedConversation ? (
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-9 w-9"
                    onClick={() => setSelectedConversation(null)}
                    data-testid="button-back-conversations"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gray-200">
                      {(
                        selectedConversation as any
                      ).contactName?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {user?.username === "demouser"
                          ? selectedConversation?.contactName
                            ? selectedConversation.contactName
                              .slice(0, -1)
                              .replace(/./g, "*") +
                            selectedConversation.contactName.slice(-1)
                            : selectedConversation?.contactPhone
                              ? selectedConversation.contactPhone
                                .slice(0, -4)
                                .replace(/\d/g, "*") +
                              selectedConversation.contactPhone.slice(-4)
                              : "Unknown"
                          : (selectedConversation as any)?.contactName ||
                          selectedConversation?.contactPhone ||
                          "Unknown"}
                      </h3>

                      <Badge
                        variant={
                          selectedConversation.status === "resolved"
                            ? "secondary"
                            : "default"
                        }
                        className="text-xs"
                      >
                        {selectedConversation.status || "open"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {user?.username === "demouser"
                        ? selectedConversation?.contact?.phone
                          ? selectedConversation.contact.phone
                            .slice(0, -4)
                            .replace(/\d/g, "*") +
                          selectedConversation.contact.phone.slice(-4)
                          : selectedConversation?.contactPhone
                            ? selectedConversation.contactPhone
                              .slice(0, -4)
                              .replace(/\d/g, "*") +
                            selectedConversation.contactPhone.slice(-4)
                            : ""
                        : selectedConversation?.contact?.phone ||
                        selectedConversation?.contactPhone ||
                        ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {user?.username !== "demouser" &&
                    selectedConversation.assignedTo !== user?.id ? (
                    <TeamAssignDropdown
                      conversationId={selectedConversation.id}
                      currentAssignee={
                        selectedConversation.assignedTo || undefined
                      }
                      currentAssigneeName={
                        selectedConversation?.assignedToName || undefined
                      }
                      onAssign={handleAssignConversation}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-sm text-gray-700 px-4 py-2 w-full text-left hover:bg-gray-100"
                      disabled
                    >
                      Assign to team member
                    </button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Status</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={user?.username === "demouser"}
                        onClick={() => updateConversationStatus("open")}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Mark as Open
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={user?.username === "demouser"}
                        onClick={() => updateConversationStatus("resolved")}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Mark as Resolved
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleViewContact()}>
                        <UserIcon className="mr-2 h-4 w-4" />
                        View Contact
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={user?.username === "demouser"}
                        onClick={() => handleArchiveChat()}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive Chat
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={user?.username === "demouser"}
                        onClick={() => handleBlockContact()}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Block Contact
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={user?.username === "demouser"}
                        className="text-red-600"
                        onClick={() => handleDeleteChat()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* Messages Area - Updated */}
            <ScrollArea className="flex-1 p-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMTBoNDBNMTAgMHY0ME0wIDIwaDQwTTIwIDB2NDBNMCAzMGg0ME0zMCAwdjQwIiBmaWxsPSJub25lIiBzdHJva2U9IiNlMGUwZTAiIG9wYWNpdHk9IjAuMiIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')]">
              <div className="min-h-full">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loading />
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No messages yet. Start a conversation!
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.map((message: Message, index: number) => {
                      const prevMessage =
                        index > 0 ? messages[index - 1] : null;
                      const showDate =
                        !prevMessage ||
                        !isToday(new Date(message.createdAt || new Date())) ||
                        (prevMessage &&
                          !isToday(
                            new Date(prevMessage.createdAt || new Date())
                          ));

                      return (
                        <MessageItem
                          key={message.id}
                          message={message}
                          showDate={showDate}
                        />
                      );
                    })}

                    {/* Typing Indicator */}
                    {isTyping && (
                      <div className="flex items-end gap-2 mb-4">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-gray-200 text-xs">
                            {typingUser[0] || "V"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                          <div className="flex gap-1">
                            <span
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            ></span>
                            <span
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            ></span>
                            <span
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            ></span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Message Input - Updated with typing handler */}
            <div className="bg-white border-t border-gray-200 p-3 md:p-4">
              {is24HourWindowExpired &&
                selectedConversation.type === "whatsapp" && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800">
                          24-hour window expired
                        </p>
                        <p className="text-yellow-700">
                          You can only send template messages now
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              <div className="flex items-end gap-1 md:gap-2">
                <div className="flex gap-1">
                  {selectedConversation.type === "whatsapp" && (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 md:h-9 md:w-9"
                              onClick={handleFileAttachment}
                              disabled={user?.username === "demouser"}
                            >
                              <Paperclip className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Attach File</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        onChange={handleFileChange}
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                      />

                      {user?.username === "demouser" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 md:h-9 md:w-9"
                                disabled
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Templates disabled for demo user
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <TemplateDialog
                          channelId={activeChannel?.id}
                          onSelectTemplate={handleSelectTemplate}
                        />
                      )}
                    </>
                  )}
                </div>

                <Input
                  placeholder={
                    is24HourWindowExpired &&
                      selectedConversation.type === "whatsapp"
                      ? "Templates only"
                      : "Type a message..."
                  }
                  value={messageText}
                  onChange={handleTyping}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={
                    user?.username === "demouser"
                      ? true
                      : is24HourWindowExpired &&
                      selectedConversation.type === "whatsapp"
                  }
                  className="flex-1"
                />

                <Button
                  onClick={handleSendMessage}
                  disabled={
                    user?.username === "demouser"
                      ? true
                      : !messageText.trim() ||
                      (is24HourWindowExpired &&
                        selectedConversation.type === "whatsapp") ||
                      sendMessageMutation.isPending
                  }
                  size="icon"
                  className="h-8 w-8 md:h-9 md:w-9 bg-green-600 hover:bg-green-700"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
