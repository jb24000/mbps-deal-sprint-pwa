// /workflow/workflow.config.js
export default {
  stages: ["Prospect","Lead","Under Contract","Title/Attorney","Closing"],
  flows: {
    Prospect: {
      required: ["basic_info","initial_comps"],
      checklist: [
        { id:"basic_info",    label:"Enter address + owner details" },
        { id:"initial_comps", label:"Add 3 comps (quick) and estimate ARV" },
        { id:"qualify_seller",label:"Qualify seller motivation & timeline" }
      ],
      nextStage: "Lead",
      nextText: "Prospect complete → Move to **Lead** and create seller contact + follow-up tasks?"
    },
    Lead: {
      required: ["seller_contact","appointment"],
      checklist: [
        { id:"seller_contact", label:"Create/Link seller contact" },
        { id:"appointment",    label:"Set inspection/virtual walk-through appointment" },
        { id:"offer_ready",    label:"Prepare initial offer range" }
      ],
      nextStage: "Under Contract",
      nextText: "Lead complete → Move to **Under Contract** and create contract checklist?"
    },
    "Under Contract": {
      required: ["contract_uploaded","buyer_outreach"],
      checklist: [
        { id:"contract_uploaded", label:"Upload signed purchase agreement" },
        { id:"buyer_outreach",    label:"Send to VIP buyers list" },
        { id:"dispo_price",       label:"Set dispo price and margin" }
      ],
      nextStage: "Title/Attorney",
      nextText: "Contract in place → Move to **Title/Attorney** and create title packet checklist?"
    },
    "Title/Attorney": {
      required: ["title_opened","hoa_payoff"],
      checklist: [
        { id:"title_opened",   label:"Open title with attorney and send packet" },
        { id:"hoa_payoff",     label:"Request HOA & payoff statements" },
        { id:"clear_exceptions",label:"Track title exceptions to clear" }
      ],
      nextStage: "Closing",
      nextText: "Title opened → Move to **Closing** and create closing-day checklist?"
    },
    Closing: {
      required: ["final_walk","wire_instr"],
      checklist: [
        { id:"final_walk",    label:"Final walk-through scheduled/completed" },
        { id:"wire_instr",    label:"Verify wire instructions with attorney" },
        { id:"closing_packet",label:"Prepare closing packet for all parties" }
      ],
      nextStage: null,
      nextText: "All set! Closing tasks created. No further stage."
    }
  }
};
