create index if not exists conversations_contact_whatsapp_id_idx
  on conversations(contact_whatsapp_id);

create index if not exists reply_drafts_conversation_id_idx
  on reply_drafts(conversation_id);
