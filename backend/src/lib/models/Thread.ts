import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReply {
  replyId: string;
  author: {
    userId: string;
    name: string;
  };
  content: string;
  createdAt: Date;
}

export interface IComment {
  commentId: string;
  author: {
    userId: string;
    name: string;
  };
  content: string;
  upvotes: string[];
  replies: IReply[];
  createdAt: Date;
}

export interface IThread extends Document {
  topicId: string;
  title: string;
  author: {
    userId: string;
    name: string;
    avatar?: string;
  };
  content: string;
  upvotes: string[];
  resolved: boolean;
  bestAnswerId?: string;
  comments: IComment[];
  createdAt: Date;
}

const ReplySchema = new Schema<IReply>({
  replyId: { type: String, required: true },
  author: {
    userId: { type: String, required: true },
    name: { type: String, required: true },
  },
  content: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

const CommentSchema = new Schema<IComment>({
  commentId: { type: String, required: true },
  author: {
    userId: { type: String, required: true },
    name: { type: String, required: true },
  },
  content: { type: String, required: true },
  upvotes: { type: [String], default: [] },
  replies: { type: [ReplySchema], default: [] },
  createdAt: { type: Date, default: () => new Date() },
});

const ThreadSchema = new Schema<IThread>({
  topicId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  author: {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String },
  },
  content: { type: String, required: true },
  upvotes: { type: [String], default: [] },
  resolved: { type: Boolean, default: false },
  bestAnswerId: { type: String },
  comments: { type: [CommentSchema], default: [] },
  createdAt: { type: Date, default: () => new Date() },
});

const Thread: Model<IThread> = mongoose.models.Thread || mongoose.model<IThread>('Thread', ThreadSchema);

export default Thread;
