import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMarketDemand extends Document {
  skill: string;
  source: 'github' | 'linkedin';
  demandScore: number; // e.g. github star counts or job post frequencies
  updatedAt: Date;
}

const MarketDemandSchema = new Schema<IMarketDemand>({
  skill: { type: String, required: true },
  source: { type: String, required: true },
  demandScore: { type: Number, required: true },
  updatedAt: { type: Date, default: () => new Date() },
});

MarketDemandSchema.index({ skill: 1, source: 1 }, { unique: true });

const MarketDemand: Model<IMarketDemand> = mongoose.models.MarketDemand || mongoose.model<IMarketDemand>('MarketDemand', MarketDemandSchema);
export default MarketDemand;
