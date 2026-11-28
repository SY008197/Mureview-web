import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";

const COLLECTION_NAME = "reviews";

function getCreatedAtMillis(item) {
  if (!item || !item.createdAt) return 0;
  if (typeof item.createdAt.toMillis === "function") {
    return item.createdAt.toMillis();
  }
  if (typeof item.createdAt.seconds === "number") {
    return item.createdAt.seconds * 1000;
  }
  return 0;
}

export const reviewRepository = {
  async createReview({
    trackId = "",
    ownerId,
    authorName,
    songTitle,
    artist,
    albumName = "",
    artworkUrl = "/img/featured_item_1.jpg",
    musicUrl = "",
    rating,
    comment,
  }) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      trackId,
      ownerId,
      authorName,
      songTitle,
      artist,
      albumName,
      artworkUrl,
      musicUrl,
      rating: Number(rating),
      comment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async getAllReviews() {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  },

  async getReviewsByTrackId(trackId) {
    if (!trackId) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      where("trackId", "==", String(trackId))
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .sort((a, b) => getCreatedAtMillis(b) - getCreatedAtMillis(a));
  },

  async hasUserReviewedTrack(trackId, ownerId) {
    if (!trackId || !ownerId) return false;
    const trackReviews = await this.getReviewsByTrackId(trackId);
    return trackReviews.some((review) => review.ownerId === ownerId);
  },

  async updateReview(reviewId, { rating, comment }) {
    const reviewRef = doc(db, COLLECTION_NAME, reviewId);
    await updateDoc(reviewRef, {
      rating: Number(rating),
      comment,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteReview(reviewId) {
    const reviewRef = doc(db, COLLECTION_NAME, reviewId);
    await deleteDoc(reviewRef);
  },
};