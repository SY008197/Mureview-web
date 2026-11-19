import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";

const COLLECTION_NAME = "reviews";

export const reviewRepository = {
  async createReview({ ownerId, authorName, songTitle, artist, rating, comment }) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ownerId,
      authorName,
      songTitle,
      artist,
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