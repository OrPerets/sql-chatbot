import { Db, ObjectId } from 'mongodb';
import { connectToDatabase, COLLECTIONS } from './database';
import { generateId } from './models';
import type { AnalysisResult, AnalysisRequest } from './ai-analysis';
import type { AnalysisResultModel } from './models';

/**
 * Analysis Service for managing AI analysis results
 * 
 * This service handles storage, retrieval, and management of AI analysis results
 * for student submissions.
 */

export class AnalysisService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Save analysis result to database
   */
  async saveAnalysisResult(analysis: AnalysisResult): Promise<AnalysisResult> {
    const analysisModel: AnalysisResultModel = {
      id: analysis.id,
      submissionId: analysis.submissionId,
      studentId: analysis.studentId,
      homeworkSetId: analysis.homeworkSetId,
      analysisType: analysis.analysisType,
      status: analysis.status,
      confidence: analysis.confidence,
      results: analysis.results,
      metadata: analysis.metadata,
    };

    await this.db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .insertOne(analysisModel);

    return analysis;
  }

  /**
   * Get analysis result by ID
   */
  async getAnalysisResult(analysisId: string): Promise<AnalysisResult | null> {
    const analysis = await this.db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .findOne({ 
        $or: [
          { _id: new ObjectId(analysisId) },
          { id: analysisId }
        ]
      });

    if (!analysis) return null;

    return {
      id: analysis._id?.toString() || analysis.id,
      submissionId: analysis.submissionId,
      studentId: analysis.studentId,
      homeworkSetId: analysis.homeworkSetId,
      analysisType: analysis.analysisType,
      status: analysis.status,
      confidence: analysis.confidence,
      results: analysis.results,
      metadata: analysis.metadata,
    };
  }

  /**
   * Get analysis results for a submission
   */
  async getAnalysisResultsForSubmission(submissionId: string): Promise<AnalysisResult[]> {
    const analyses = await this.db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .find({ submissionId })
      .sort({ 'metadata.createdAt': -1 })
      .toArray();

    return analyses.map(analysis => ({
      id: analysis._id?.toString() || analysis.id,
      submissionId: analysis.submissionId,
      studentId: analysis.studentId,
      homeworkSetId: analysis.homeworkSetId,
      analysisType: analysis.analysisType,
      status: analysis.status,
      confidence: analysis.confidence,
      results: analysis.results,
      metadata: analysis.metadata,
    }));
  }

  /**
   * Get analysis results for a student
   */
  async getAnalysisResultsForStudent(studentId: string, homeworkSetId?: string): Promise<AnalysisResult[]> {
    const query: any = { studentId };
    if (homeworkSetId) {
      query.homeworkSetId = homeworkSetId;
    }

    const analyses = await this.db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .find(query)
      .sort({ 'metadata.createdAt': -1 })
      .toArray();

    return analyses.map(analysis => ({
      id: analysis._id?.toString() || analysis.id,
      submissionId: analysis.submissionId,
      studentId: analysis.studentId,
      homeworkSetId: analysis.homeworkSetId,
      analysisType: analysis.analysisType,
      status: analysis.status,
      confidence: analysis.confidence,
      results: analysis.results,
      metadata: analysis.metadata,
    }));
  }

  /**
   * Get analysis results for a homework set
   */
  async getAnalysisResultsForHomeworkSet(homeworkSetId: string): Promise<AnalysisResult[]> {
    const analyses = await this.db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .find({ homeworkSetId })
      .sort({ 'metadata.createdAt': -1 })
      .toArray();

    return analyses.map(analysis => ({
      id: analysis._id?.toString() || analysis.id,
      submissionId: analysis.submissionId,
      studentId: analysis.studentId,
      homeworkSetId: analysis.homeworkSetId,
      analysisType: analysis.analysisType,
      status: analysis.status,
      confidence: analysis.confidence,
      results: analysis.results,
      metadata: analysis.metadata,
    }));
  }

  /**
   * Update analysis result status
   */
  async updateAnalysisStatus(
    analysisId: string, 
    status: AnalysisResult['status'],
    results?: AnalysisResult['results'],
    confidence?: number
  ): Promise<AnalysisResult | null> {
    const updateData: any = {
      status,
    };

    if (status === 'completed') {
      updateData['metadata.completedAt'] = new Date().toISOString();
    }

    if (results) {
      updateData.results = results;
    }

    if (confidence !== undefined) {
      updateData.confidence = confidence;
    }

    const result = await this.db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .findOneAndUpdate(
        { 
          $or: [
            { _id: new ObjectId(analysisId) },
            { id: analysisId }
          ]
        },
        { $set: updateData },
        { returnDocument: 'after' }
      );

    if (!result) return null;

    return {
      id: result._id?.toString() || result.id,
      submissionId: result.submissionId,
      studentId: result.studentId,
      homeworkSetId: result.homeworkSetId,
      analysisType: result.analysisType,
      status: result.status,
      confidence: result.confidence,
      results: result.results,
      metadata: result.metadata,
    };
  }

  /**
   * Delete analysis result
   */
  async deleteAnalysisResult(analysisId: string): Promise<boolean> {
    const result = await this.db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .deleteOne({ 
        $or: [
          { _id: new ObjectId(analysisId) },
          { id: analysisId }
        ]
      });

    return result.deletedCount > 0;
  }

  /**
   * Get analysis statistics for a homework set
   */
  async getAnalysisStatistics(homeworkSetId: string): Promise<{
    totalAnalyses: number;
    completedAnalyses: number;
    failedAnalyses: number;
    averageConfidence: number;
    commonErrorPatterns: Array<{ pattern: string; count: number }>;
    topRecommendations: Array<{ type: string; count: number }>;
  }> {
    const analyses = await this.db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .find({ homeworkSetId })
      .toArray();

    const totalAnalyses = analyses.length;
    const completedAnalyses = analyses.filter(a => a.status === 'completed').length;
    const failedAnalyses = analyses.filter(a => a.status === 'failed').length;
    const averageConfidence = analyses.length > 0 
      ? analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length 
      : 0;

    // Extract common error patterns
    const errorPatterns: Record<string, number> = {};
    const recommendations: Record<string, number> = {};

    for (const analysis of analyses) {
      if (analysis.status === 'completed' && analysis.results) {
        // Count error patterns
        if (analysis.results.errorPatterns) {
          for (const pattern of analysis.results.errorPatterns) {
            errorPatterns[pattern.pattern] = (errorPatterns[pattern.pattern] || 0) + 1;
          }
        }

        // Count recommendations
        if (analysis.results.recommendations) {
          for (const rec of analysis.results.recommendations) {
            recommendations[rec.type] = (recommendations[rec.type] || 0) + 1;
          }
        }
      }
    }

    const commonErrorPatterns = Object.entries(errorPatterns)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topRecommendations = Object.entries(recommendations)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalAnalyses,
      completedAnalyses,
      failedAnalyses,
      averageConfidence,
      commonErrorPatterns,
      topRecommendations,
    };
  }

  /**
   * Clean up old analysis results
   */
  async cleanupOldAnalyses(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .deleteMany({
        'metadata.createdAt': { $lt: cutoffDate.toISOString() }
      });

    return result.deletedCount;
  }
}

/**
 * Static service instance
 */
let analysisService: AnalysisService | null = null;

export async function getAnalysisService(): Promise<AnalysisService> {
  if (!analysisService) {
    const { db } = await connectToDatabase();
    analysisService = new AnalysisService(db);
  }
  return analysisService;
}

/**
 * Convenience functions that use the service
 */
export async function saveAnalysisResult(analysis: AnalysisResult): Promise<AnalysisResult> {
  const service = await getAnalysisService();
  return service.saveAnalysisResult(analysis);
}

export async function getAnalysisResult(analysisId: string): Promise<AnalysisResult | null> {
  const service = await getAnalysisService();
  return service.getAnalysisResult(analysisId);
}

export async function getAnalysisResultsForSubmission(submissionId: string): Promise<AnalysisResult[]> {
  const service = await getAnalysisService();
  return service.getAnalysisResultsForSubmission(submissionId);
}

export async function getAnalysisResultsForStudent(studentId: string, homeworkSetId?: string): Promise<AnalysisResult[]> {
  const service = await getAnalysisService();
  return service.getAnalysisResultsForStudent(studentId, homeworkSetId);
}

export async function getAnalysisResultsForHomeworkSet(homeworkSetId: string): Promise<AnalysisResult[]> {
  const service = await getAnalysisService();
  return service.getAnalysisResultsForHomeworkSet(homeworkSetId);
}

export async function updateAnalysisStatus(
  analysisId: string, 
  status: AnalysisResult['status'],
  results?: AnalysisResult['results'],
  confidence?: number
): Promise<AnalysisResult | null> {
  const service = await getAnalysisService();
  return service.updateAnalysisStatus(analysisId, status, results, confidence);
}

export async function deleteAnalysisResult(analysisId: string): Promise<boolean> {
  const service = await getAnalysisService();
  return service.deleteAnalysisResult(analysisId);
}

export async function getAnalysisStatistics(homeworkSetId: string) {
  const service = await getAnalysisService();
  return service.getAnalysisStatistics(homeworkSetId);
}

export async function cleanupOldAnalyses(daysOld: number = 30): Promise<number> {
  const service = await getAnalysisService();
  return service.cleanupOldAnalyses(daysOld);
}
