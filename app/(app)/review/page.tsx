import { permanentRedirect } from "next/navigation";

/** Review is a tab inside Thoughts now. Old links, bookmarks and the `g r`
 *  shortcut still land in the right place. */
export default function ReviewPage() {
  permanentRedirect("/thoughts?pane=review");
}
