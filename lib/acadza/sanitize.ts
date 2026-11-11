import sanitizeHtml from "sanitize-html"

const mathTags = [
  "math", "maction", "maligngroup", "malignmark", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mprescripts", "mroot", "mrow", "ms", "mscarries", "mscarry", "msgroup", "msline", "mspace", "msqrt", "msrow", "mstack", "mstyle", "msub", "msubsup", "msup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "semantics", "annotation",
]
const tags = [...sanitizeHtml.defaults.allowedTags, ...mathTags, "img", "figure"]

export function cleanQuestionHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: tags,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["class", "style", "xmlns", "display", "mathvariant", "stretchy", "fence", "form", "encoding", "alt", "src", "width", "height"],
    },
    allowedSchemes: ["http", "https", "data"],
    allowProtocolRelative: false,
  })
}
